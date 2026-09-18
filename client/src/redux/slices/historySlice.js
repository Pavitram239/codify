import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "../../utils/axiosInstance";
import { logout } from "../userSlice";

export const fetchHistory = createAsyncThunk(
  "history/fetchHistory",
  async ({ page = 1, limit = 9 }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(
        "/submissions/user/submissions",
        {
          params: { page, limit },
        }
      );

      return {
        history: response.data.submissions || [],
        totalPages: response.data.totalPages || 1,
        currentPage: page,
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          "Failed to load submission history. Please try again."
      );
    }
  }
);

const historySlice = createSlice({
  name: "history",
  initialState: {
    history: [],
    loading: false,
    error: null,
    totalPages: 1,
    currentPage: 1,
    navigationInProgress: false,
  },
  reducers: {
    clearHistory(state) {
      state.history = [];
      state.loading = false;
      state.error = null;
      state.currentPage = 1;
      state.totalPages = 1;
    },
    setCurrentPage(state, action) {
      state.currentPage = action.payload;
    },
    logoutHistory: (state) => {
      state.history = [];
      state.loading = false;
      state.error = null;
      state.currentPage = 1;
      state.totalPages = 1;
    },
    startNavigation(state) {
      state.navigationInProgress = true;
      // Preserve existing data during navigation
      state.error = null;
    },
    endNavigation(state) {
      state.navigationInProgress = false;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHistory.pending, (state) => {
        state.loading = true;
        state.error = null;
        // Don't clear history during loading to avoid abrupt UI changes
      })
      .addCase(fetchHistory.fulfilled, (state, action) => {
        state.loading = false;
        state.history = action.payload.history;
        state.totalPages = action.payload.totalPages;
        state.currentPage = action.payload.currentPage;
        state.navigationInProgress = false;
      })
      .addCase(fetchHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "An error occurred.";
        // Don't clear history on error to maintain previous state
      })
      // Handle user logout action from userSlice
      .addCase(logout, (state) => {
        state.history = [];
        state.loading = false;
        state.error = null;
        state.currentPage = 1;
        state.totalPages = 1;
      });
  },
});

export const { clearHistory, setCurrentPage, logoutHistory, startNavigation, endNavigation } = historySlice.actions;
export default historySlice.reducer;
