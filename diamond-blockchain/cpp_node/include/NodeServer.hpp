#pragma once
#include <iostream>
#include <nlohmann/json.hpp>
#include "httplib.h"
#include "Blockchain.hpp"

using json = nlohmann::json;

class NodeServer
{
public:
    NodeServer(Blockchain &chain) : blockchain(chain) {}

    void start(int port = 8081)
    {
        httplib::Server svr;

        // POST /events  → add transaction or block
        svr.Post("/events", [&](const httplib::Request &req, httplib::Response &res)
                 {
            try {
                json data = json::parse(req.body);
                blockchain.addTransaction(Transaction(
                    data["from"].get<std::string>(),
                    data["to"].get<std::string>(),
                    data["amount"].get<double>(),
                    data["type"].get<std::string>()
                ));
                blockchain.minePendingTransactions("system");

                res.set_content(
                    json{{"status", "ok"}, {"message", "Event recorded"}}.dump(),
                    "application/json");
            } catch (std::exception& e) {
                res.status = 400;
                res.set_content(
                    json{{"error", e.what()}}.dump(),
                    "application/json");
            } });

        // GET /chain → return entire blockchain
        svr.Get("/chain", [&](const httplib::Request &, httplib::Response &res)
                {
            json out = blockchain.toJSON();
            res.set_content(out.dump(2), "application/json"); });

        std::cout << "🟢 NodeServer running on port " << port << "..." << std::endl;
        svr.listen("0.0.0.0", port);
    }

private:
    Blockchain &blockchain;
};
