#include "Transaction.hpp"
#include <sstream>
#include <openssl/sha.h>

static std::string txHash(const std::string &s)
{
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256(reinterpret_cast<const unsigned char *>(s.c_str()), s.size(), hash);
    std::ostringstream ss;
    for (int i = 0; i < SHA256_DIGEST_LENGTH; ++i)
        ss << std::hex << std::setw(2) << std::setfill('0') << (int)hash[i];
    return ss.str();
}

json Transaction::toJson() const
{
    return json{
        {"txId", txId},
        {"from", from},
        {"to", to},
        {"amount", amount},
        {"type", type},
        {"meta", meta},
        {"timestamp", timestamp}};
}

Transaction Transaction::fromJson(const json &j)
{
    Transaction t;
    t.txId = j.value("txId", std::string());
    t.from = j.at("from").get<std::string>();
    t.to = j.at("to").get<std::string>();
    t.amount = j.at("amount").get<double>();
    t.type = j.at("type").get<std::string>();
    t.meta = j.at("meta").get<json>();
    t.timestamp = j.at("timestamp").get<uint64_t>();
    if (t.txId.empty())
    {
        t.txId = txHash(t.from + t.to + std::to_string(t.timestamp) + std::to_string(t.amount));
    }
    return t;
}
