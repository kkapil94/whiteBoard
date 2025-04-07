import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { RootState } from "../index";

const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token;

    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
    return headers;
  },
});

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery,
  tagTypes: ["User"],
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (creds) => ({
        url: "/user/login",
        method: "POST",
        body: creds,
      }),
    }),
    register: builder.mutation({
      query: (creds) => ({
        url: "/user/register",
        method: "POST",
        body: creds,
      }),
    }),
  }),
});

export const { useLoginMutation, useRegisterMutation } = authApi;
