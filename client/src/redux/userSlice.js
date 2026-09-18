import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "../utils/axiosInstance";

export const fetchProfilePicThunk = createAsyncThunk(
  "user/fetchProfilePic",
  async (_, {getState, rejectWithValue }) => {
    try {
      const {
        app: { user },
      } = getState();
      const avatarId = user?.profile?.avatar;
      console.log("avatarId", avatarId);
      console.log("user", user);
      if (!avatarId) return null;
      console.log("fetching profile pic");
      const response = await axiosInstance.get("/user/profile/upload-avatar", {
        responseType: "blob",
      });
      const imageUrl = URL.createObjectURL(response.data);
      return imageUrl;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch profile picture"
      );
    }
  }
);

const userSlice = createSlice({
  name: "user",
  initialState: {
    authStatus: false,
    user: null,
    imageUrl: null,
    isLoading: false,
    pageTransitioning: false,
  },
  reducers: {
    setUser: (state, action) => {
      state.authStatus = true;
      state.user = action.payload;
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setImageUrl: (state, action) => {
      state.imageUrl = action.payload;
    },
    startPageTransition: (state) => {
      state.pageTransitioning = true;
    },
    endPageTransition: (state) => {
      state.pageTransitioning = false;
    },
    logout: (state) => {
      state.user = null;
      state.authStatus = false;
      state.imageUrl = null;
      state.isLoading = false;
      state.pageTransitioning = false;
    },    
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProfilePicThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchProfilePicThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.imageUrl = action.payload;
      })
      .addCase(fetchProfilePicThunk.rejected, (state, action) => {
        state.isLoading = false;
        // Add error handling if needed
        state.imageUrl = null;
      });
  },
});

export const { 
  setUser, 
  setLoading, 
  setImageUrl, 
  logout, 
  startPageTransition, 
  endPageTransition 
} = userSlice.actions;

export default userSlice.reducer;