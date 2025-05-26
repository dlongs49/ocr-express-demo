var createError = require("http-errors");
var express = require("express");
var path = require("path");
const http = require("http");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const bodyParser = require("body-parser");
const { createWorker } = require("tesseract.js");
const multer = require("multer");

var app = express();
var cors = require("cors");
const server = http.createServer(app);
const io = require("socket.io")(server, { cors: true, pingInterval: 2000 });
app.use(cors());
server.listen(8001);
io.on("connection", (socket) => {
  console.log(socket.id + " 连接成功");
});

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/images");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

app.post("/upload", upload.single("file"), async (req, res) => {
  let stime = new Date().getTime();
  const worker = await createWorker("chi_sim+eng", 1, {
    logger: (e) => {
      io.sockets.emit("msg", {
        progress: e.progress,
        status:
          e.status == "loading tesseract core"
            ? "正在加载tesseract核心"
            : e.status == "initializing tesseract"
            ? "正在初始化tesseract"
            : e.status == "loading language traineddata"
            ? "正在加载语言训练数据"
            : e.status == "initializing api"
            ? "初始化api中"
            : e.status == "recognizing text"
            ? "正在识别文本"
            : "未知",
      });
    },
  });
  const ret = await worker.recognize(
    path.join(__dirname, "public/images", req.file.filename)
  );
  await worker.terminate();
  let etime = new Date().getTime();
  res.json({
    url: `/images/${req.file.filename}`,
    text: ret.data.text,
    res_time: (etime - stime) / 1000 + "秒",
  });
});

app.use("/", (req, res) => {
  res.render("index");
});

app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
