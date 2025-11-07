# Frontend Tests

## Running Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with UI
npm run test:ui
```

## Test Structure

- `components/__tests__/Login.test.tsx`: Component tests for Login page
  - Tests form rendering
  - Tests login flow for user and admin
  - Tests error handling
  
- `pages/__tests__/Home.test.tsx`: Component tests for Home page
  - Tests drops list rendering
  - Tests join/leave functionality
  - Tests logout functionality

## Test Setup

Tests use Vitest with React Testing Library and jsdom for DOM simulation.
All mocks are configured in `setup.ts`.

