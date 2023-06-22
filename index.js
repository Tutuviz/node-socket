import axios from 'axios';
import express from 'express';
import fs from 'fs';
import path from 'path';
import pkg from 'sqlite3';

import { faker } from '@faker-js/faker';
import { v4 as uuidv4 } from 'uuid';

const { Database } = pkg;

const __dirname = path.resolve();

const db = new Database("db.sqlite");

const app = express();
app.use(express.json());

const PORT_RANGE_START = 3000;
const PORT_RANGE_END = 3100;

const jsonFilePath = 'servers.json';
const roleFunctions = [];

const products = [
  "apple",
  "banana",
  "orange",
  "pear",
  "pineapple",
  "grape",
  "strawberry",
  "blueberry",
  "raspberry",
  "blackberry",
  "watermelon",
  "melon",
  "mango",
  "kiwi",
  "peach",
]

function query(sql, params) {
  return new Promise(function (resolve, reject) {
    db.all(sql, params, function (error, result) {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

function startDatabase() {
  db.exec(fs.readFileSync(__dirname + "/setup.sql").toString());
}

function getAll() {
  return JSON.parse(fs.readFileSync(jsonFilePath));
}

function addToJson(server) {
  const servers = getAll();
  servers.push(server);
  fs.writeFileSync(jsonFilePath, JSON.stringify(servers, null, 2));
}

function removeFromJson(serverId) {
  const servers = getAll();
  const index = servers.findIndex((server) => server.id === serverId);
  servers.splice(index, 1);
  fs.writeFileSync(jsonFilePath, JSON.stringify(servers, null, 2));
}

function serverFunctions() {
  startDatabase();

  const serverLog = setInterval(async () => {
    console.log("Hi, I'm the server! 🦆")
  }, 20000);

  roleFunctions.push(serverLog);

  app.post('/create', async (req, res) => {
    const { name, product, price, date } = req.body;

    if (!name || !product || !price || !date) {
      return res.status(400).send('Missing fields');
    }

    console.log(`Um vendedor ${name} está cadastrando uma venda!`)

    if (!products.includes(product)) {
      return res.status(400).send('Invalid product');
    }

    await query("INSERT INTO sales (name, product, price, date) VALUES (?, ?, ?, ?)", [name, product, price, date]);

    res.status(201).send('Created');
  });

  app.get('/total/seller/:id', async (req, res) => {
    const id = req.params.id;

    if (!id) {
      return res.status(400).send('Missing fields');
    }

    console.log(`Um gerente está consultando o total de vendas do vendedor ${id}!`)

    const response = await query("SELECT COUNT(*) FROM sales WHERE name = ?", [id]);

    res.status(200).send(response[0]);
  });

  app.get('/total/product/:id', async (req, res) => {
    const id = req.params.id;

    if (!id) {
      return res.status(400).send('Missing fields');
    }

    console.log(`Um gerente está consultando o total de vendas do produto ${id}!`)

    const response = await query("SELECT COUNT(*) FROM sales WHERE product = ?", [id]);

    res.status(200).send(response[0]);
  });

  app.get('/total/range/:start/:end', async (req, res) => {
    const { start, end } = req.params;

    if (!start || !end) {
      return res.status(400).send('Missing fields');
    }

    console.log(`Um gerente está consultando o total de vendas entre ${start} e ${end}!`)

    const response = await query("SELECT COUNT(*) FROM sales WHERE date BETWEEN ? AND ?", [start, end]);

    res.status(200).send(response[0]);
  });

  app.get('/best/seller', async (req, res) => {
    console.log(`Um gerente está consultando o melhor vendedor!`)
    const response = await query("SELECT name, COUNT(*) FROM sales GROUP BY name ORDER BY COUNT(*) DESC LIMIT 1");

    res.status(200).send(response[0]);
  });

  app.get('/best/product', async (req, res) => {
    console.log(`Um gerente está consultando o melhor produto!`)
    const response = await query("SELECT product, COUNT(*) FROM sales GROUP BY product ORDER BY COUNT(*) DESC LIMIT 1");

    res.status(200).send(response[0]);
  });
}

function sellerFunctions() {
  const registerSell = setInterval(async () => {
    const server = await getServer();

    if (server) {
      const product = {
        name: thisServer.id,
        product: products[Math.floor(Math.random() * products.length)],
        price: Math.floor(Math.random() * 1000),
        date: faker.date.between({ from: '2023-01-01T00:00:00.000Z', to: '2023-06-23T00:00:00.000Z' })
      }

      console.log("Cadastrar Venda: ", product)

      await axios.post(`http://localhost:${server.port}/create`, product)
    }
  }, Math.floor(Math.random() * 3000) + 15000);

  roleFunctions.push(registerSell);
}

function managerFunctions() {
  const managerFunction = setInterval(async () => {
    const server = await getServer();

    if (server) {
      const options = ["getBestSeller", "getBestProduct", "getTotalSeller", "getTotalProduct", "getTotalRange"]

      const option = options[Math.floor(Math.random() * options.length)]

      switch (option) {
        case "getBestSeller":
          console.log("Consultar Melhor Vendedor")
          const seller = await axios.get(`http://localhost:${server.port}/best/seller`)
          console.log("Melhor Vendedor: ", seller.data)
          break;

        case "getBestProduct":
          console.log("Consultar Melhor Produto")
          const product = await axios.get(`http://localhost:${server.port}/best/product`)
          console.log("Melhor Produto: ", product.data)
          break;

        case "getTotalSeller":
          const sellers = getAll().filter(server => server.type === "seller").map(server => server.id)
          const randomSeller = sellers[Math.floor(Math.random() * sellers.length)]
          console.log("Consultar total de vendas do vendedor", randomSeller)

          const totalSeller = await axios.get(`http://localhost:${server.port}/total/seller/${randomSeller}`)
          console.log("Total de vendas do vendedor", randomSeller, totalSeller.data)
          break;

        case "getTotalProduct":
          const randomProduct = products[Math.floor(Math.random() * products.length)]
          console.log("Consultar total de vendas do produto", randomProduct)

          const totalProduct = await axios.get(`http://localhost:${server.port}/total/product/${randomProduct}`)
          console.log("Total de vendas do produto", randomProduct, totalProduct.data)
          break;

        case "getTotalRange":
          const dates = faker.date.betweens({ from: '2023-01-01T00:00:00.000Z', to: '2023-06-23T00:00:00.000Z', count: 2 })

          const date1 = dates[0].toISOString().split('T')[0]
          const date2 = dates[1].toISOString().split('T')[0]

          console.log("Consultar total de vendas entre", date1, "e", date2)

          const totalRange = await axios.get(`http://localhost:${server.port}/total/range/${date1}/${date2}`)
          console.log("Total de vendas entre", date1, "e", date2, totalRange.data)
          break;
      }
    }
  }, Math.floor(Math.random() * 3000) + 15000);

  roleFunctions.push(managerFunction);
}

function getRoles(type) {
  console.log("resetting roles")
  roleFunctions.forEach((roleFunction) => clearInterval(roleFunction));

  console.log(`setting roles for ${type}`)
  if (type === 'seller') {
    sellerFunctions();
  } else if (type === 'manager') {
    managerFunctions();
  } else if (type === 'server') {
    serverFunctions();
  }
}

function start() {
  const servers = getAll();

  // TODO: remove empty ports?

  let nextPort = PORT_RANGE_START;
  while (nextPort <= PORT_RANGE_END) {
    if (!servers.find((server) => server.port === nextPort.toString())) {
      break;
    }
    nextPort++;
  }

  if (nextPort > PORT_RANGE_END) {
    console.error('No available ports');
    process.exit(1);
  }

  const args = process.argv.slice(2);

  const role = args[0] ?? Math.random() < 0.5 ? 'seller' : 'manager';

  const id = faker.person.firstName()

  getRoles(role);

  return {
    id: id,
    type: role,
    port: nextPort.toString(),
  };
}

async function electServer() {
  console.log("electing server")

  const clients = getAll();

  let elected = false

  for (const client of clients) {
    console.log(`electing ${client.id}`)
    await axios.get(`http://localhost:${client.port}/elect`)
      .then(() => {
        console.log(`Server ${client.port} is up and turned into server`);
        elected = true
      })
      .catch((err) => {
        // console.error(err);
        // add retry?
        console.log(`Server ${client.port} is down`);

        removeFromJson(client.id)
      });

    if (elected) {
      console.log(`${client.id} on port ${client.port} was elected, breaking...`)
      break;
    }
  }
}

async function getServer() {
  const server = await getAll().find((server) => server.type === "server");
  try {
    await axios.get(`http://localhost:${server.port}/ping`)

    return server;
  } catch (error) {
    console.log(`Server ${server ? server.id + "is down" : "not found"}`);
    await electServer();
  }
}

app.get('/ping', (req, res) => {
  res.send('pong');
});

const thisServer = start();

function becomeServer() {
  const servers = getAll();

  const index = servers.findIndex((server) => server.id === thisServer.id);

  getRoles("server");

  servers[index] = {
    id: uuidv4(),
    type: "server",
    port: thisServer.port,
  };

  fs.writeFileSync(jsonFilePath, JSON.stringify(servers, null, 2));
}

app.get('/elect', (req, res) => {
  try {
    becomeServer();
  } catch (error) {
    console.log(error);
  }

  res.send('ok');
});

app.listen(thisServer.port, () => {
  addToJson(thisServer);
  console.log(`${thisServer.type} ${thisServer.id} running on port ${thisServer.port}`);
});
