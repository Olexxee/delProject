#pragma once
#include <string>
#include <nlohmann/json.hpp>
using json = nlohmann::json;

struct Transaction
{
    std::string txId; // optional, can be hash of contents
    std::string from; // user id or 'SYSTEM'
    std::string to;   // user id or contract
    double amount;
    std::string type; // e.g., 'reward','transfer','mint','nft_mint'
    json meta;        // arbitrary metadata
    uint64_t timestamp;

    json toJson() const;
    static Transaction fromJson(const json &j);
};.