import React, { useContext } from "react";
import { UserContext } from "../context/UserContext";
import AppStack from "../stacks/AppStack";
import AuthStack from "../stacks/AuthStack";

const RootNavigation = () => {
  const { user } = useContext(UserContext);

  return user ? <AppStack /> : <AuthStack />;
};

export default RootNavigation;
