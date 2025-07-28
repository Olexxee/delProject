import React, { useState, useContext } from "react";
import fabio from "../assets/Images/fabio.jpg";
import KeyboardWrapper from "./KeyboardWrapper";
import Icon from "react-native-vector-icons/FontAwesome";
import { UserContext } from "../context/UserContext";

const Login = () => {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });

  const { loginUser } = useContext(UserContext);

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const handleLogin = async () => {
    try {
      const response = await fetch(
        "http://192.168.43.162:5000/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        Alert.alert("Login Failed", data.message || "Invalid credentials");
        return;
      }

      if (data.token && data.user) {
        await loginUser(data.token, data.user); // ✅ use context
      } else {
        Alert.alert("Login Failed", "Unexpected response from server");
      }
    } catch (error) {
      console.error("Login error:", error.message);
      Alert.alert("Error", "Something went wrong. Try again.");
    }
  };

  const InputWithIcon = ({
    icon,
    placeholder,
    value,
    onChangeText,
    secureTextEntry,
  }) => (
    <View style={styles.inputContainer}>
      <Icon name={icon} size={18} color="#888" style={styles.icon} />
      <TextInput
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        placeholderTextColor="#aaa"
      />
    </View>
  );

  return (
    <ImageBackground source={fabio} style={styles.background}>
      <KeyboardWrapper>
        <View style={styles.formContainer}>
          <Text style={styles.heading}>Login</Text>

          <InputWithIcon
            icon="user"
            placeholder="Username"
            value={form.username}
            onChangeText={(text) => handleChange("username", text)}
          />

          <InputWithIcon
            icon="envelope"
            placeholder="Email"
            value={form.email}
            onChangeText={(text) => handleChange("email", text)}
          />

          <InputWithIcon
            icon="lock"
            placeholder="Password"
            value={form.password}
            onChangeText={(text) => handleChange("password", text)}
            secureTextEntry
          />

          <TouchableOpacity onPress={handleLogin} style={styles.button}>
            <Text style={styles.buttonText}>Log In</Text>
          </TouchableOpacity>
        </View>
      </KeyboardWrapper>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    resizeMode: "cover",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  formContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    padding: 24,
    borderRadius: 12,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  heading: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 24,
    color: "#333",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  button: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default Login;
