import { configureStore, combineReducers } from "@reduxjs/toolkit";
import { persistStore, persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";
import userReducer from "./userSlice";
import submissionReducer from "./slices/submissionSlice";
import historyReducer from "./slices/historySlice";

const rootReducer = combineReducers({
  app: userReducer,
  submissions: submissionReducer,
  history: historyReducer,
});

const persistConfig = {
  key: "root",
  storage,
  whitelist: ["app"],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export const persistor = persistStore(store);
