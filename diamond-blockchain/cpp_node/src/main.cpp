#include <iostream>
#include "Blockchain.hpp"
#include "nlohmann/json.hpp"
#include "NodeServer.hpp"

using json = nlohmann::json;

int main(int argc, char **argv)
{
    std::cout << "🚀 DiamondElounge C++ Blockchain Node starting..." << std::endl;

    // Initialize blockchain
    Blockchain chain;

    // Optional: add one demo transaction
    Transaction tx;
    tx.from = "SYSTEM";
    tx.to = "user_123";
    tx.amount = 10.0;
    tx.type = "reward";
    tx.timestamp = (uint64_t)time(nullptr);
    chain.addTransaction(tx);
    chain.minePendingTransactions("miner_01");

    std::cout << "✅ Initial chain valid: " << (chain.isValid() ? "true" : "false") << std::endl;

    // --- Start HTTP server ---
    NodeServer server(chain);
    std::cout << "🟢 Starting NodeServer on port 8081..." << std::endl;
    server.start(8081); // keeps process running

    return 0;
}
