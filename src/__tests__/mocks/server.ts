// src/__tests__/mocks/server.ts
// MSW server setup for integration tests.
// Start this before tests, stop after.

import { setupServer } from "msw/node";
import { allHandlers } from "./handlers";

export const mockServer = setupServer(...allHandlers);
