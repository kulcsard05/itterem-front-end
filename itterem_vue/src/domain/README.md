# Domain

Purpose: domain-focused contract adaptation and normalization logic.

Current areas:
- `order`: order payload reading, fallback handling, DTO normalization.

Rules:
- Place feature/domain-specific parsing logic here instead of `shared`.
- Keep this layer independent from Vue UI components.
