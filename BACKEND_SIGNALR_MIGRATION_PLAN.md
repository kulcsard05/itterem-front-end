# Backend SignalR (WebSockets) migration plan (replace SSE)

Date: 2026-03-04

## Why SignalR (WebSockets) instead of SSE or polling?
### Why this is better than the current SSE approach
- **Reliable “rooms” and targeting:** SignalR has first-class **groups** (rooms) and user targeting patterns. With SSE you end up reinventing grouping/routing logic yourself.
- **Better long-lived connection ergonomics:** SignalR handles reconnects, transport negotiation, and fallbacks. SSE is simpler, but you typically do more manual work around reconnection/backoff, multi-stream coordination, and fanout.
- **Two-way channel is available if you ever need it:** This migration still uses server→client events only (minimal scope), but WebSockets keep the door open for later (e.g., client acknowledgements, “mark as seen”, etc.) without redesigning the transport.

### Why WebSockets must be implemented on the backend (not “frontend-only”)
- **Browsers can’t be the server:** The client (frontend) cannot accept inbound WebSocket connections from other clients. Browsers initiate connections; they don’t listen on ports like a server.
- **Backend is the source of truth:** Only the backend knows *when* an order status changed or catalog data was mutated (DB writes happen there). If the frontend “hosts” realtime, it would still need a trusted backend feed — which puts you back at implementing realtime on the backend.
- **Security + trust boundaries:** You don’t want clients broadcasting “order changed” events to other clients; that enables spoofing. The backend must be the authority that emits realtime events after successful validation + persistence.
- **Network reality:** Clients sit behind NAT/firewalls and come/go. A stable, reachable endpoint for realtime fanout is the backend.

### Why this is better than “ping/poll when something changes”
- **Lower latency:** Polling only updates at the next interval (e.g., every 5–10s). WebSockets push immediately.
- **Less wasted load:** Polling creates constant traffic even when nothing changes (DB reads, auth checks, serialization). WebSockets keep one connection and only send data when needed.
- **No missed edge cases:** With polling you can race (status flips twice between polls), create thundering herds (many clients polling at once), and you still need extra logic to decide “did anything change?”. Push avoids that by emitting a clear invalidation event.

## Goal
Replace the current SSE-based “instant refresh” with **WebSockets via SignalR**, so:

- Customers instantly see their **own** order status changes.
- Employees instantly see **incoming orders** and status changes.
- Admins see the same realtime operational updates.
- When an admin mutates the catalog (menu/items/etc.), clients get a realtime **invalidation** event so they can refresh.

Hard requirement: **delete the current SSE implementation entirely**.

## Scope (minimal)
This plan changes only the ASP.NET Core backend in the repo:

- ../itterem-back-end-/vizsgaremek/Program.cs
- ../itterem-back-end-/vizsgaremek/Controllers/RendelesekController.cs
- Catalog mutation controllers (POST/PUT/DELETE), at minimum:
  - ../itterem-back-end-/vizsgaremek/Controllers/MenukController.cs
  - ../itterem-back-end-/vizsgaremek/Controllers/KeszetelekController.cs
  - (and the other existing controllers that mutate catalog data)

No new pages, no extra UX features, no payload-heavy broadcasts. REST remains the source of truth.

## Current state (what exists today)
### Authentication + policies
Backend already has JWT auth and policies in place:

- JWT bearer setup + policies live in ../itterem-back-end-/vizsgaremek/Program.cs
- Role mapping is numeric via the `jogosultsag` claim:
  - user = `1`
  - employee = `2`
  - admin = `3`

### SSE endpoints (to be removed)
SSE lives in ../itterem-back-end-/vizsgaremek/Controllers/RendelesekController.cs:

- `GET /api/Rendelesek/stream` (new orders)
- `GET /api/Rendelesek/status-stream` (status updates)

These are driven by `OrderSignalService` (Channel-based signaling) in the same file.

## Target realtime design (SignalR)
### Single hub endpoint
Expose a single SignalR hub:

- `GET /hubs/realtime` (SignalR negotiates transport; WebSockets preferred)

### “Rooms” (SignalR groups)
Implement **3 rooms** as SignalR groups:

- `room:user`
- `room:employee`
- `room:admin`

Also implement a **per-user group** for correct privacy:

- `user:{sub}` where `sub` is the user id from the JWT

This still satisfies “3 rooms” while enabling user-targeted status updates.

### Event contract (minimal)
Keep the payloads stable and small:

- `orders.changed` → no payload
  - Meaning: “Employees/admins should refetch orders.”
- `orders.statusChanged` → payload `{ id, status }`
  - Meaning: “Order #id status changed.”
- `catalog.changed` → no payload
  - Meaning: “Catalog changed; refetch menu/items.”

## Implementation steps

### 1) Add a SignalR hub
Create a new file:

- ../itterem-back-end-/vizsgaremek/Hubs/RealtimeHub.cs

Minimal hub skeleton:

```csharp
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace vizsgaremek.Hubs;

[Authorize(Policy = "Mindenki")]
public sealed class RealtimeHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var lvl = Context.User?.FindFirst("jogosultsag")?.Value;
        var sub = Context.User?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
               ?? Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (!string.IsNullOrWhiteSpace(sub))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user:{sub}");
        }

        // exactly one “room:*” group
        var room = lvl switch
        {
            "3" => "room:admin",
            "2" => "room:employee",
            _ => "room:user"
        };

        await Groups.AddToGroupAsync(Context.ConnectionId, room);

        await base.OnConnectedAsync();
    }
}
```

Notes:
- Authorization is enforced at the hub.
- This does not implement custom hub methods (not needed). Clients only subscribe to server-pushed events.

### 2) Wire SignalR + JWT token extraction for WebSockets
Edit ../itterem-back-end-/vizsgaremek/Program.cs:

1) Register SignalR services:

```csharp
builder.Services.AddSignalR();
```

2) Update `AddJwtBearer(...)` so SignalR can read tokens sent as `access_token` in the query string during the WebSocket handshake.

Add inside `.AddJwtBearer(options => { ... })`:

```csharp
options.Events = new JwtBearerEvents
{
    OnMessageReceived = context =>
    {
        // SignalR uses `?access_token=...` for WebSockets
        var accessToken = context.Request.Query["access_token"].ToString();
        var path = context.HttpContext.Request.Path;

        if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/realtime"))
        {
            context.Token = accessToken;
        }

        return Task.CompletedTask;
    }
};
```

3) Map the hub endpoint (after `UseAuthentication()` / `UseAuthorization()`):

```csharp
app.MapHub<RealtimeHub>("/hubs/realtime");
```

### 3) Replace SSE with hub broadcasts (orders)
Edit ../itterem-back-end-/vizsgaremek/Controllers/RendelesekController.cs.

#### 3.1 Delete SSE code entirely
Remove:

- `OrderStatusUpdate`
- `OrderSignalService`
- `GetRendelesStream`
- `GetStatusStream`
- `WriteNewRendelesek`
- DI constructor that injects `OrderSignalService`
- Any `NotifyChange()` / `NotifyStatusChange(...)` calls

#### 3.2 Broadcast from existing mutation points
Do not invent new flows. Broadcast right where state changes already happen:

- After successful `Post([FromBody] OrderDto orderDto)` (order created or appended):
  - Send `orders.changed` to `room:employee` and `room:admin`.

- After successful `ModifyStatus(int id, string status)`:
  - Send `orders.statusChanged` to `room:employee` and `room:admin`.
  - Also send `orders.statusChanged` to the specific user group `user:{FelhasznaloId}`.

Minimal broadcasting without controller constructor injection (keeps edits small):

```csharp
using Microsoft.AspNetCore.SignalR;
using vizsgaremek.Hubs;

var hub = HttpContext.RequestServices.GetRequiredService<IHubContext<RealtimeHub>>();

await hub.Clients.Group("room:employee").SendAsync("orders.changed");
await hub.Clients.Group("room:admin").SendAsync("orders.changed");
```

For status updates:

```csharp
await hub.Clients.Group("room:employee").SendAsync("orders.statusChanged", new { id = result.Id, status = result.Statusz });
await hub.Clients.Group("room:admin").SendAsync("orders.statusChanged", new { id = result.Id, status = result.Statusz });

await hub.Clients.Group($"user:{result.FelhasznaloId}").SendAsync(
    "orders.statusChanged",
    new { id = result.Id, status = result.Statusz }
);
```

Important: ensure `result.FelhasznaloId` is available (it should be on the `Rendelesek` entity you load).

### 4) Broadcast `catalog.changed` after catalog mutations
For each controller action that **mutates** catalog data (POST/PUT/DELETE), after a successful `SaveChangesAsync()` broadcast:

- `catalog.changed` to:
  - `room:user`
  - `room:employee`
  - `room:admin`

Example pattern (apply to each mutation action):

```csharp
using Microsoft.AspNetCore.SignalR;
using vizsgaremek.Hubs;

var hub = HttpContext.RequestServices.GetRequiredService<IHubContext<RealtimeHub>>();
await hub.Clients.Group("room:user").SendAsync("catalog.changed");
await hub.Clients.Group("room:employee").SendAsync("catalog.changed");
await hub.Clients.Group("room:admin").SendAsync("catalog.changed");
```

Start with these (already confirmed to have mutations):

- ../itterem-back-end-/vizsgaremek/Controllers/MenukController.cs
  - `PostMenu`, `PutMenu`, `DeleteMenu`
- ../itterem-back-end-/vizsgaremek/Controllers/KeszetelekController.cs
  - `PostKeszetelek`, `PutKeszetelek`, `DeleteKEszetel`

Then apply the same pattern to other catalog controllers that mutate state (Koretek/Uditok/Kategoria/Hozzavalok/etc.).

### 5) Remove leftover SSE registration
Edit ../itterem-back-end-/vizsgaremek/Program.cs:

- Delete `builder.Services.AddSingleton<OrderSignalService>();`

Optional cleanup:
- Remove the old SSE test page under ../itterem-back-end-/vizsgaremek/TEST if you no longer need it.

## Smoke test checklist
From the repo root:

- Build: `dotnet build ../itterem-back-end-/vizsgaremek/vizsgaremek.csproj`
- Run: `dotnet run --project ../itterem-back-end-/vizsgaremek/vizsgaremek.csproj`

Manual validation:

- Login as employee/admin:
  - Create an order as a user → employee/admin receives `orders.changed`
  - Change status → employee/admin receives `orders.statusChanged`
- Login as a user:
  - Change status of that user’s order → that user receives `orders.statusChanged`
  - Confirm other users do not receive it
- As admin:
  - Add/update/delete menu/item → all rooms receive `catalog.changed`

## Notes / constraints
- Keep events minimal (mostly invalidation). Clients should refetch via REST.
- Don’t broadcast full order lists unless you later choose to optimize.
- The backend currently sets CORS to `AllowAnyOrigin`. That is permissive; tighten later if needed, but it’s not required for this migration.
