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
import { Feather } from "@expo/vector-icons"; 
import { UserContext } from "../context/UserContext"; 

const RegisterPage = ({ navigation }) => {
  const { loginUser } = useContext(UserContext);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (key, value) => {
    setForm({ ...form, [key]: value });
  };

  const handleRegister = async () => {
    // Basic validation
    if (!form.fullName || !form.email || !form.password) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    if (form.password !== form.confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    try {
      const response = await fetch(
        "http://192.168.43.162:5000/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: form.fullName,
            email: form.email,
            phone: form.phone,
            password: form.password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        Alert.alert(
          "Registration Failed",
          data.message || "Something went wrong"
        );
        return;
      }

      if (data.token && data.user) {
        await loginUser(data.token, data.user); 
        Alert.alert("Success", "Account created successfully!");
      } else {
        Alert.alert("Registration Failed", "Unexpected response from server");
      }
    } catch (error) {
      console.error("Registration error:", error.message);
      Alert.alert("Error", "Something went wrong. Try again.");
    }
  };

  const RenderInput = ({
    icon,
    placeholder,
    value,
    onChangeText,
    secure = false,
    keyboardType = "default",
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
        keyboardType={keyboardType}
      />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create an Account</Text>

      <RenderInput
        icon="user"
        placeholder="Full Name"
        value={form.fullName}
        onChangeText={(text) => handleChange("fullName", text)}
      />

      <RenderInput
        icon="mail"
        placeholder="Email Address"
        value={form.email}
        onChangeText={(text) => handleChange("email", text)}
        keyboardType="email-address"
      />

      <RenderInput
        icon="phone"
        placeholder="Phone Number"
        value={form.phone}
        onChangeText={(text) => handleChange("phone", text)}
        keyboardType="phone-pad"
      />

      <RenderInput
        icon="lock"
        placeholder="Password"
        value={form.password}
        onChangeText={(text) => handleChange("password", text)}
        secure
      />

      <RenderInput
        icon="lock"
        placeholder="Confirm Password"
        value={form.confirmPassword}
        onChangeText={(text) => handleChange("confirmPassword", text)}
        secure
      />

      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("Login")}>
        <Text style={styles.linkText}>Already have an account? Log in</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
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
  button: {
    backgroundColor: "#4A90E2",
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
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

export default RegisterPage;
