import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "../../utils/axiosInstance";
import { logout, setUser } from "../userSlice";
import { errorMessage } from "../../utils/errorMessage";

const accountId = (user) => user?._id || user?.id || null;
const initialState = {
  submissions: [],
  loading: false,
  status: "idle",
  userId: null,
  activeRequestId: null,
  error: null,
  selectedSubmission: null,
};

export const fetchSubmissions = createAsyncThunk(
  "submissions/fetchSubmissions",
  async ({ page = 1, limit = 7 } = {}, { getState, rejectWithValue, signal }) => {
    const userId = accountId(getState().app.user);
    try {
      const response = await axiosInstance.get("/submissions/user/submissions", {
        params: { page, limit },
        signal,
      });
      return { userId, submissions: response.data.submissions || [] };
    } catch (error) {
      return rejectWithValue(errorMessage(error.response?.data, "Failed to fetch submissions."));
    }
  },
  {
    condition: ({ force = false } = {}, { getState }) => {
      const { app, submissions } = getState();
      const userId = accountId(app.user);
      if (!userId) return false;
      if (submissions.userId !== userId) return true;
      if (submissions.status === "loading") return false;
      // An empty successful response and a failed response are both completed attempts.
      return submissions.status === "idle" || force;
    },
    getPendingMeta: (_, { getState }) => ({ userId: accountId(getState().app.user) }),
  }
);

const submissionSlice = createSlice({
  name: "submissions",
  initialState,
  reducers: {
    setSelectedSubmission(state, action) {
      state.selectedSubmission = action.payload;
    },
    clearSubmissions: () => initialState,
    addSubmission(state, action) {
      state.submissions.unshift(action.payload);
      state.selectedSubmission = action.payload;
    },
    logoutSubmissions: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSubmissions.pending, (state, action) => {
        if (state.userId !== action.meta.userId) {
          state.submissions = [];
          state.selectedSubmission = null;
        }
        state.userId = action.meta.userId;
        state.activeRequestId = action.meta.requestId;
        state.status = "loading";
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSubmissions.fulfilled, (state, action) => {
        if (state.activeRequestId !== action.meta.requestId) return;
        state.activeRequestId = null;
        state.status = "succeeded";
        state.loading = false;
        state.submissions = action.payload.submissions;
        state.selectedSubmission = action.payload.submissions[0] || null;
      })
      .addCase(fetchSubmissions.rejected, (state, action) => {
        if (state.activeRequestId !== action.meta.requestId) return;
        state.activeRequestId = null;
        state.status = action.meta.aborted ? "idle" : "failed";
        state.loading = false;
        state.error = action.meta.aborted ? null : action.payload || "Failed to fetch submissions.";
      })
      .addCase(setUser, (state, action) => {
        if (state.userId && accountId(action.payload) !== state.userId) return initialState;
      })
      .addCase(logout, () => initialState);
  },
});

export const { setSelectedSubmission, clearSubmissions, addSubmission, logoutSubmissions } = submissionSlice.actions;
export default submissionSlice.reducer;
