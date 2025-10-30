import React, { useState, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import Feather from "react-native-vector-icons/Feather";
import { UserContext } from "../context/UserContext";

const LoginPage = ({ navigation }) => {
  const { loginUser } = useContext(UserContext);

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const handleChange = (key, value) => {
    setForm({ ...form, [key]: value });
  };

  const handleLogin = async () => {
    try {
      const response = await fetch(
        "http://192.168.43.162:5000/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        Alert.alert("Login Failed", data.message || "Invalid credentials");
        return;
      }

      if (data.token && data.user) {
        await loginUser(data.token, data.user);
      } else {
        Alert.alert("Login Failed", "Unexpected response from server");
      }
    } catch (error) {
      console.error("Login error:", error.message);
      Alert.alert("Error", "Something went wrong. Try again.");
    }
  };

  const RenderInput = ({
    icon,
    placeholder,
    value,
    onChangeText,
    secure = false,
  }) => (
    <View style={styles.inputWrapper}>
      <Feather name={icon} size={20} color="#999" style={styles.icon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#999"
        secureTextEntry={secure}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );

  return (
    <View style={styles.maincontainer}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Welcome Back</Text>

        <RenderInput
          icon="mail"
          placeholder="Email Address"
          value={form.email}
          onChangeText={(text) => handleChange("email", text)}
        />

        <RenderInput
          icon="lock"
          placeholder="Password"
          value={form.password}
          onChangeText={(text) => handleChange("password", text)}
          secure
        />

        <TouchableOpacity
          onPress={() => Alert.alert("Feature not implemented")}
        >
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Log In</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Register")}>
          <Text style={styles.linkText}>Don't have an account? Sign Up</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  maincontainer: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignContent: "center",
    alignItems: "center",
    height: "100%",
  },
  container: {
    flex: 1,  
    padding: 10,
    backgroundColor: "#fff",
    flexGrow: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    marginBottom: 32,
    color: "#111",
    textAlign: "center",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: "#333",
  },
  forgotText: {
    textAlign: "right",
    color: "#4A90E2",
    marginBottom: 24,
    fontSize: 14,
  },
  button: {
    backgroundColor: "#4A90E2",
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 24,
  },
  buttonText: {
    textAlign: "center",
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  linkText: {
    color: "#4A90E2",
    textAlign: "center",
    fontSize: 14,
  },
});

export default LoginPage;
