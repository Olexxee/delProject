// context/UserContext.js

import React, { createContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // Refresh user using stored token
  const refreshUser = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        setUser(null);
        return;
      }

      const response = await fetch("http://192.168.43.162:5000/api/auth/user", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn("Server responded with error:", errorText);
        setUser(null);
        return;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        const text = await response.text();
        throw new Error(`Expected JSON, got: ${text}`);
      }

      const data = await response.json();
      setUser(data.user || null);
    } catch (error) {
      console.error("Error refreshing user:", error.message || error);
      setUser(null);
    }
  };

  // TO Call after successful login
  const loginUser = async (token, userData) => {
    try {
      await AsyncStorage.setItem("token", token);
      setUser(userData);
    } catch (error) {
      console.error("Error saving token:", error.message);
    }
  };

  // Called on logout
  const logoutUser = async () => {
    try {
      await AsyncStorage.removeItem("token");
      setUser(null);
    } catch (error) {
      console.error("Error removing token:", error.message);
    }
  };

  // Auto-refresh user on app start
  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, loginUser, logoutUser, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
};
