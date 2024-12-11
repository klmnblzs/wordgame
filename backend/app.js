const express = require("express");
const fs = require("fs");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const port = 3200;
const mysql = require("mysql2/promise");

const { Server } = require("socket.io");

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "root",
  database: "wordgame",
  port: 8889,
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

async function getWords() {
  fs.readFile("./words.txt", "utf8", (err, data) => {
    if (err) {
      return res.status(500).json({ error: "Error while loading files" });
    }
    return words = data.split("\n").map((word) => word.trim().toLowerCase());
  });
}

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);
app.use(express.json());

io.on("connection", (socket) => {
  socket.on("join", async (username) => {
    try {
      console.log("Joined: " + socket.id + " (" + username + ")")
      const [playerJoined] = await pool.query(
        "INSERT INTO players (socket_id, username, is_active) VALUES (?, ?, TRUE)",
        [socket.id, username]
      );

      const playerId = playerJoined.insertId;
      socket.emit("playerJoined", { playerId });

      const [words] = await pool.query("SELECT * FROM words");
      io.emit("updateWords", words);

      const [players] = await pool.query("SELECT username FROM players");
      io.emit(
        "updatePlayers",
        players.map((player) => player.username)
      );

      if(players.length == 1) {
        await pool.query('UPDATE game_state SET current_turn_id=?',[playerId])
      }
    } catch (error) {
      console.error("Error adding player:", error);
    }
  });

  socket.on("addWord", async ({ word, playerId }) => {
    try {
      const [gameStateResult] = await pool.query(
        "SELECT * FROM game_state LIMIT 1"
      );

      doubleLetters = ["ny", "sz", "cs", "dz", "zs", "ly"]
      const gameState = gameStateResult[0];
      // if(doubleLetters.includes(word.slice(-2)))
      const lastLetter = gameState?.last_letter || "";
      
      if ((lastLetter && (word[0].toLowerCase() !== lastLetter.toLowerCase()) && (word.substring(0,2).toLowerCase() !== lastLetter.toLowerCase()))) {
        socket.emit(
          "addWordError",
          "Hibás betű. Várt betű: " + lastLetter
        );
        return;
      }

      if (gameState?.current_turn_id !== playerId) {
        socket.emit("addWordError", "Nem te vagy a soron!");
        return;
      }

      const [usedWords] = await pool.query('SELECT COUNT(*) AS count FROM words WHERE LOWER(word) = ?', [word])
      
      if(usedWords[0].count > 0) {
        socket.emit('addWordError', { error: 'Ezt a szavat már használták' });
        return;
      }

      await pool.query("INSERT INTO words (word, player_id) VALUES (?, ?)", [
        word,
        playerId,
      ]);

      const nextPlayerId = await getNextPlayerId(gameState.current_turn_id);
      await pool.query(
        "UPDATE game_state SET last_letter = ?, current_turn_id = ?",
        [doubleLetters.includes(word.slice(-2).toLowerCase()) ? word.slice(-2).toLowerCase() : word.slice(-1).toLowerCase(), nextPlayerId]
      );

      const [words] = await pool.query("SELECT * FROM words");
      io.emit("updateWords", words);

      const [updatedGameState] = await pool.query(
        "SELECT * FROM game_state LIMIT 1"
      );

      const [nextPlayer] = await pool.query("SELECT username FROM players WHERE id = ?", [nextPlayerId]);

      io.emit("updateGameState", {
        gameState: updatedGameState,
        word: word,
        current_turn_username: nextPlayer[0]?.username || "Tudja a fasz",
      });
    } catch (error) {
      console.error("Error adding word:", error);
      socket.emit("addWordError", "An error occurred while adding the word.");
    }
  });

  socket.on("disconnect", async () => {
    try {
      await pool.query("DELETE FROM players WHERE socket_id = ?", [socket.id]);
      console.log("Disconnected: " + socket.id);

      const [players] = await pool.query("SELECT username FROM players");

      if(players.length>0) {
        io.emit(
          "updatePlayers",
          players.map((player) => player.username)
        );
      } else {
        await pool.query("DELETE FROM words")
        await pool.query("UPDATE game_state SET last_letter=''")
      }

    } catch (error) {
      console.error("Error removing player:", error);
    }
  });
});

async function getNextPlayerId(currentTurnId) {
  const [players] = await pool.query("SELECT id FROM players ORDER BY id");
  const currentIndex = players.findIndex(
    (player) => player.id === currentTurnId
  );
  const nextIndex = (currentIndex + 1) % players.length;
  return players[nextIndex]?.id;
}

server.listen(3000, () => {
  console.log("server on port 3000");
});

app.get("/words", (req, res) => {
  fs.readFile("./words.txt", "utf8", (err, data) => {
    if (err) {
      return res.status(500).json({ error: "Error while loading files" });
    }
    const words = data.split("\n").map((word) => word.trim().toLowerCase());
    res.json(words);
  });
});

app.listen(port, () => {
  console.log(`app on port ${port}`);
});
