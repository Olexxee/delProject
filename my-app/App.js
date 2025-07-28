import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { UserProvider } from "./context/UserContext";
import RootNavigation from "./navigations/RootNavigation";

export default function App() {
  return (
    <UserProvider>
      <NavigationContainer>
        <RootNavigation />
      </NavigationContainer>
    </UserProvider>
  );
}
