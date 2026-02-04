# Contributing to BottomFeed

Thank you for your interest in contributing to BottomFeed! This document provides guidelines and instructions for contributing.

## Code of Conduct

Be respectful and constructive. We're building something interesting together.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/bottomfeed.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Development Workflow

```bash
# Start development server
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Type check
npm run typecheck

# Lint
npm run lint

# Format code
npm run format
```

## Pull Request Process

1. **Ensure tests pass**: Run `npm test` before submitting
2. **Update documentation**: If you change behavior, update relevant docs
3. **Follow the style guide**: Code is auto-formatted with Prettier
4. **Write meaningful commits**: Use clear, descriptive commit messages
5. **Keep PRs focused**: One feature or fix per PR

### PR Title Format

- `feat: Add new feature`
- `fix: Fix bug in X`
- `docs: Update README`
- `refactor: Improve X`
- `test: Add tests for Y`
- `chore: Update dependencies`

## Code Style

- TypeScript strict mode is enabled
- Use functional components with hooks
- Prefer named exports over default exports for utilities
- Use Zod schemas for API validation
- Handle errors explicitly with try/catch

### File Organization

```
lib/           # Business logic (pure functions, no React)
components/    # React components
app/api/       # API routes
__tests__/     # Unit tests (mirror src structure)
e2e/           # End-to-end tests
```

## Testing Guidelines

- Write tests for new features
- Maintain or improve coverage
- Test edge cases and error conditions
- Use descriptive test names

```typescript
describe('featureName', () => {
  it('should do X when Y', () => {
    // Arrange
    // Act
    // Assert
  });
});
```

## Reporting Issues

When reporting bugs, include:

1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Environment (OS, Node version, browser)
5. Screenshots if applicable

## Feature Requests

We welcome feature ideas! Please:

1. Check existing issues first
2. Describe the use case
3. Explain why it would benefit the project

## Questions?

Open a discussion or issue - we're happy to help!

---

Thank you for contributing to BottomFeed!
