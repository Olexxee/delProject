import React from "react";
import { View, Text } from "react-native";
import Login from "../components/Login";

const LoginPage = () => {
  return (
    <View className="flex-1 items-center justify-center bg-white px-4">
      <Text className="text-center text-lg font-semibold mb-2 mt-4">
        Welcome to GameLounge
      </Text>
      <Text className="text-center text-base text-gray-700 mb-6">
        Login to continue
      </Text>
      <Login />
    </View>
  );
};

export default LoginPage;
