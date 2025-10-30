#pragma once
#include <vector>
#include <mutex>
#include "Block.hpp"
#include "Transaction.hpp"

class Blockchain
{
public:
    Blockchain();
    Block createGenesis();
    Block getLatest() const;
    void addBlock(const Block &b);
    void addTransaction(const Transaction &tx);
    void minePendingTransactions(const std::string &minerAddress); 
    bool isValid() const;
    std::vector<Block> getChain() const;

private:
    std::vector<Block> chain;
    std::vector<Transaction> pendingTransactions;
    mutable std::mutex mtx;

    void persist();
    void load();
};