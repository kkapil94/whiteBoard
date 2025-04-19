import { configureStore } from "@reduxjs/toolkit";

import authReducer from "./slices/authSlice.ts";
import { authApi } from "./api/authApi.ts";
import { boardApi } from "./api/boardApi.ts";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [authApi.reducerPath]: authApi.reducer,
    [boardApi.reducerPath]: boardApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(authApi.middleware, boardApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
