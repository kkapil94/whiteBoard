import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { RootState } from "../index";

export interface Board {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    name: string | null;
    username: string;
    avatar: string | null;
  };
  members: {
    id: string;
    name: string | null;
    username: string;
    avatar: string | null;
  }[];
  _count?: {
    members: number;
  };
}

const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token;
    console.log(token);

    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
    return headers;
  },
});

export const boardApi = createApi({
  reducerPath: "boardApi",
  baseQuery,
  tagTypes: ["Board"],
  endpoints: (builder) => ({
    getBoards: builder.query<Board[], void>({
      query: () => "/boards",
      providesTags: ["Board"],
    }),
    createBoard: builder.mutation<Board, { name: string }>({
      query: (body) => ({
        url: "/boards",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Board"],
    }),
    deleteBoard: builder.mutation<void, string>({
      query: (id) => ({
        url: `/boards/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Board"],
    }),
  }),
});

export const {
  useGetBoardsQuery,
  useCreateBoardMutation,
  useDeleteBoardMutation,
} = boardApi;
