// #pragma once
#include <string>
#include <vector>
// #include <nlohmann/json.hpp> // use nlohmann json (add to CMake)


using json = nlohmann::json;


struct Block {
uint64_t index;
std::string previousHash;
std::string hash;
uint64_t timestamp; // epoch ms
json data; // generic event payload
uint64_t nonce; // reserved for PoA/PoW if needed


Block() = default;
Block(uint64_t idx, const std::string &prev, uint64_t ts, const json &payload);


std::string calculateHash() const;
json toJson() const;
static Block fromJson(const json &j);
};