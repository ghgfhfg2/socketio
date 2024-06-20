const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

//require("events").EventEmitter.prototype._maxListeners = 100;

const apiUrl = "https://sydev.pe.kr/game/api/game.php";
// const io = require("socket.io")(https, {
//   cors: {
//     origin: "*",
//     methods: ["GET", "POST"],
//   },
// });

let gameSiteArray = ["index", "pay"];

let nameArray = [
  { game: "hole", guid: "1" },
  { game: "rock", guid: "2" },
  { game: "race", guid: "3" },
  { game: "ball", guid: "4" },
  { game: "avoid", guid: "5" },
  { game: "avoid2", guid: "6" },
  { game: "hunt", guid: "7" },
  { game: "hunt2", guid: "8" },
  { game: "outrun", guid: "9" },
  { game: "outrun2", guid: "10" },
  { game: "stock", guid: "11" },
  { game: "stock2", guid: "12" },
  { game: "quick", guid: "13" },
  { game: "quick2", guid: "14" },
  { game: "quickkey", guid: "15" },
  { game: "quickkey2", guid: "16" },
];

let gameSocketArray = [];

gameSiteArray.forEach((site) => {
  nameArray.forEach((el) => {
    gameSocketArray.push({
      ...el,
      title: `/${site}_${el.game}`,
    });
  });
});
//console.log("gameSocketArray", gameSocketArray);

const onConnection = async (name, game) => {
  name.on("connection", (socket) => {
    const gameTitle = game.title;
    const guid = game.guid;

    console.log(`a ${gameTitle} connected`);

    socket.on("get_user", function (data) {
      const res = JSON.stringify(data);
      name.emit("get_user", `${res}`);
    });

    //소켓id추가
    socket.on("update_id", function (data) {
      console.log("update_id", `${socket.id}`);
      socket.emit("update_id", `${socket.id}`);
    });

    //게임정보
    socket.on("get_game_info", function (data) {
      const res = JSON.stringify(data);
      name.emit("get_game_info", `${res}`);
    });
    //공던지기 토탈
    socket.on("ball_total", (totalScore) => {
      name.emit("ball_total", totalScore);
    });
    //공던지기 히트
    socket.on("ball_hit", (data) => {
      name.emit("ball_hit", data);
    });
    //공던지기 종료
    socket.on("ball_finish", (winnerUid) => {
      name.emit("ball_finish", winnerUid);
    });

    //랭킹 업데이트
    socket.on("ranking_update", () => {
      name.emit("ranking_update");
    });

    //유저내보내기
    socket.on("out_user", function (data) {
      for (key in data) {
        name.to(`${data[key]}`).emit("out_user", `${data[key]}`);
      }
    });

    //타임체크
    const timeObj = {
      isPause: false,
      timer: null,
    };
    let restTime;
    const startTimer = function (time, state) {
      endTimer();

      restTime = time;
      timeObj.isPause = false;
      timeObj.timer = setInterval(() => {
        name.emit("time_check", [restTime, state]);
        restTime--;
        if (restTime < 0) {
          endTimer();
        }
      }, 1000);
    };
    const endTimer = () => {
      console.log("endTimer");
      clearInterval(timeObj.timer);
      restTime = 0;
      timeObj.isPause = true;
      timeObj.timer = null;
    };
    socket.on("time_check", function (obj) {
      axios
        .post(apiUrl, {
          a: "time_check",
          game_uid: obj.uid,
        })
        .then((data) => {
          startTimer(obj.time, obj.state);
        });
    });

    //전광판 글자변경
    socket.on("timer_text", (data) => {
      console.log("timer_text", data);
      name.emit("timer_text", data);
    });

    socket.on("game_init", (data) => {
      endTimer();
    });

    // 게임종료 후 저장
    const gameFinish = (game) => {
      axios
        .post(apiUrl, {
          a: "game_finish",
          game_title: game.game_title,
          answer: game.answer,
          winner: game.winner,
          game_uid: game.guid,
          turn: game.turn,
          master: game.master,
        })
        .then(() => {
          console.log("피니시 저장");
        });
    };

    //유저 나갔을때
    socket.on("disconnect", async (data) => {
      await axios
        .post(apiUrl, {
          a: "user_list",
          out: "true",
          game_uid: guid,
          game_title: game.game_title,
          socketId: socket.id,
        })
        .then((res) => {
          if (res.data.isAdmin) {
            endTimer();
            for (key in res.data.data) {
              name.to(`${res.data.data[key]}`).emit("out_user", `game end`);
            }
            name.emit("get_game_list", `${data}`);

            gameFinish(res.data.game);
          } else {
            name.emit("get_user", `${data}`);
          }
        });
    });

    //게임 리스트 체크
    socket.on("get_game_list", (data) => {
      console.log(`${gameTitle} 게임생성`);
      name.emit("get_game_list", `.`);
    });
  });
};

//게임별 소켓 연결
gameSocketArray.forEach((game) => {
  console.log("game", game);
  const ioName = io.of(game.title);
  onConnection(ioName, game);
});

//chat
const chatApiUrl = "https://sydev.pe.kr/game/js/chat.php";
const siteArray = [{ title: "/index", suid: "1" }]; //site 분류

const onChatConnection = (name, site) => {
  name.on("connection", (socket) => {
    console.log(`chat connected`);

    socket.on("submit_chat", (msg, room, chat) => {
      name.to(String(room)).emit("submit_chat", msg, chat);
    });

    //소켓 room join
    socket.on("room_join", (uid) => {
      uid = String(uid);
      socket.join(String(uid));
      name.to(socket.id).emit("room_join", uid);
    });

    //관리자 대화방 입장
    socket.on("admin_join", (data) => {
      axios
        .post(chatApiUrl, {
          a: "join_admin",
          site: data.site,
          preUid: data.preUid,
          uid: data.uid,
          admin: data.admin,
          admin_socket: socket.id,
        })
        .then((res) => {
          name.emit(
            "admin_join",
            { ...data, socketId: socket.id },
            res.data.chat
          );
        });
    });

    //방 생성
    socket.on("create_room", (chat) => {
      name.emit("create_room", chat);
    });

    //대화 종료
    socket.on("finish_chat", (chat, roomId) => {
      name.emit("finish_chat", chat, roomId);
    });

    //관리자 나갔을때
    socket.on("disconnect", (data) => {
      axios
        .post(chatApiUrl, {
          a: "out_admin",
          admin_socket: socket.id,
        })
        .then(() => {
          name.emit("out_admin", socket.id);
        });
    });
  });
};

siteArray.forEach((site) => {
  const ioName = io.of(site.title);
  onChatConnection(ioName, site);
});

app.get("/", (req, res) => {
  res.send("");
});

server.listen(3000, function () {
  console.log("server listening on port %s", server.address().port);
});
