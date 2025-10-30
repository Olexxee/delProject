#include "Blockchain.hpp"

Block Blockchain::getLatest() const
{
    std::lock_guard<std::mutex> g(mtx);
    return chain.back();
}

void Blockchain::addBlock(const Block &b)
{
    std::lock_guard<std::mutex> g(mtx);
    if (!chain.empty())
    {
        // basic validation
        if (b.previousHash != chain.back().hash)
        {
            throw std::runtime_error("Previous hash mismatch");
        }
    }
    chain.push_back(b);
    persist();
}

void Blockchain::addTransaction(const Transaction &tx)
{
    std::lock_guard<std::mutex> g(mtx);
    pendingTransactions.push_back(tx);
}

void Blockchain::minePendingTransactions(const std::string &minerAddress)
{
    std::lock_guard<std::mutex> g(mtx);
    json data = json::array();
    for (const auto &t : pendingTransactions)
        data.push_back(t.toJson());
    Block newBlock(chain.size(), chain.back().hash, nowMs(), data);
    newBlock.hash = newBlock.calculateHash();
    chain.push_back(newBlock);
    pendingTransactions.clear();
    persist();
}

bool Blockchain::isValid() const
{
    std::lock_guard<std::mutex> g(mtx);
    for (size_t i = 1; i < chain.size(); ++i)
    {
        const auto &curr = chain[i];
        const auto &prev = chain[i - 1];
        if (curr.hash != curr.calculateHash())
            return false;
        if (curr.previousHash != prev.hash)
            return false;
    }
    return true;
}

std::vector<Block> Blockchain::getChain() const
{
    std::lock_guard<std::mutex> g(mtx);
    return chain;
}

void Blockchain::persist()
{
    json j = json::array();
    for (const auto &b : chain)
        j.push_back(b.toJson());
    std::ofstream ofs("chain_data.json");
    ofs << j.dump(2);
}

void Blockchain::load()
{
    std::ifstream ifs("chain_data.json");
    if (!ifs.good())
        return;
    json j;
    ifs >> j;
    chain.clear();
    for (const auto &item : j)
        chain.push_back(Block::fromJson(item));
}