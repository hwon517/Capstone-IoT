const mongoose = require("mongoose");
const express = require("express");
const server = express();
const mqtt = require("mqtt"); // MQTT 모듈 불러오기
const http = require('http');
const socketIo = require('socket.io'); // Socket.IO 모듈 추가

// 데이터베이스 스키마 정의
const UltrasonicSchema = new mongoose.Schema({
    distance: Number, // 초음파 센서로 측정된 거리
    status: String, // 주차 상태 ("Occupied" 또는 "Empty")
    created_at: { type: Date, default: Date.now } // 타임스탬프
});

const Ultrasonic = mongoose.model("Ultrasonic", UltrasonicSchema);

// MongoDB 접속 정보가 저장된 파일에 접근
require("dotenv").config({ path: "db_url.env" });

// Express 서버 설정
server.use(express.static("public"));  // 'public' 폴더에서 정적 파일 제공

// 루트 경로에 대한 응답 설정 (car.html 파일 반환)
server.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/car.html");  // car.html 파일 경로
});

const httpServer = http.createServer(server);
const io = socketIo(httpServer); // Socket.IO 설정

// Node.js에서 MQTT Broker에 접속
const client = mqtt.connect("mqtt://10.201.20.207");

client.on("connect", () => {
    console.log("MQTT Connected");
    client.subscribe("ultrasonic"); // "ultrasonic" 토픽 구독
});

// MQTT 메시지 수신 처리
client.on("message", async (topic, message) => {
    try {
        if (topic === "ultrasonic") {
            let obj = JSON.parse(message); // 읽어온 message를 JSON 형식의 개체로 변환
            obj.created_at = new Date(); // 타임스탬프 추가
            console.log("Received ultrasonic data:", obj);

            // 초음파 센서 데이터를 MongoDB에 저장
            if (obj.distance !== undefined && obj.status) {
                const ultrasonicData = new Ultrasonic({
                    distance: obj.distance,
                    status: obj.status,
                    created_at: obj.created_at
                });

                await ultrasonicData
                    .save()
                    .then(() => {
                        console.log("Insert OK");
                    })
                    .catch((err) => {
                        console.log({ message: err });
                    });
            } else {
                console.error("Invalid data format:", obj);
            }

            // 실시간 데이터 클라이언트로 전송
            io.emit('ultrasonicData', obj);
        }
    } catch (error) {
        console.error("Error processing message:", error);
    }
});

// 서버 구동
httpServer.listen(4000, (err) => {  // 포트 번호를 4000으로 변경
    if (err) {
        return console.log(err);
    } else {
        console.log("Server Ready");

        // MongoDB에 접속
        mongoose
            .connect(process.env.MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
            .then(() => {
                console.log("Connected to Database Successfully");
            })
            .catch(() => {
                console.log("Connection Failed...");
            });
    }
});
