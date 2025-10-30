cmake_minimum_required(VERSION 3.16)
project(DiamondEloungeBlockchain)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# --- Use FetchContent to include nlohmann/json ---
include(FetchContent)

FetchContent_Declare(
  json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG v3.11.3 # you can use a newer tag if needed
)
FetchContent_MakeAvailable(json)

# --- Add your source files ---
add_executable(${PROJECT_NAME}
  src/main.cpp
  src/blockchain.cpp
)

# --- Link nlohmann/json ---
target_link_libraries(${PROJECT_NAME} PRIVATE nlohmann_json::nlohmann_json)

# --- Include directories if needed ---
target_include_directories(${PROJECT_NAME} PRIVATE ${PROJECT_SOURCE_DIR}/src)
