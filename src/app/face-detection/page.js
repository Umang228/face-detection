"use client";

import React, { useEffect, useRef, useState } from "react";
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import Link from "next/link";

export default function FaceDetection() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [faceDetector, setFaceDetector] = useState(null);
  const [ctx, setCtx] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    const initializeFaceDetector = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `/models/blaze_face_short_range.tflite`,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
        });

        setFaceDetector(detector);
        console.log("FaceDetector initialized");
      } catch (error) {
        console.error("Error initializing FaceDetector:", error);
      }
    };

    initializeFaceDetector();

    if (canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      setCtx(context);
      console.log("Canvas context initialized:", context);
    }
  }, []);

  useEffect(() => {
    if (faceDetector) {
      console.log("FaceDetector is ready, starting webcam...");
      startWebcam();
    }
  }, [faceDetector]);

  const startWebcam = async () => {
    if (!faceDetector) {
      console.error("Face Detector is not yet initialized.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      videoRef.current.style.display = "block";

      // Create a stream from the canvas to include detection overlays
      const canvasStream = canvasRef.current.captureStream();
      const recorder = new MediaRecorder(canvasStream, { mimeType: "video/webm" });
      setMediaRecorder(recorder);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setRecordedChunks((prev) => [...prev, event.data]);
        }
      };

      videoRef.current.addEventListener("loadeddata", () => {
        console.log("Video loaded, starting detection");
        predictWebcam();
      });
    } catch (err) {
      console.error("Error accessing webcam:", err);
    }
  };

  const predictWebcam = async () => {
    let lastVideoTime = -1;

    const detectFaces = async () => {
      const startTimeMs = performance.now();

      if (videoRef.current && videoRef.current.currentTime !== lastVideoTime) {
        lastVideoTime = videoRef.current.currentTime;

        const results = await faceDetector.detectForVideo(
          videoRef.current,
          startTimeMs
        );

        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        // Draw the video feed onto the canvas
        ctx.drawImage(
          videoRef.current,
          0,
          0,
          canvasRef.current.width,
          canvasRef.current.height
        );

        if (results.detections.length > 0) {
          const detection = results.detections[0];

          const x =
            (detection.boundingBox.originX / videoRef.current.videoWidth) *
            canvasRef.current.width;
          const y =
            (detection.boundingBox.originY / videoRef.current.videoHeight) *
            canvasRef.current.height;
          const width =
            (detection.boundingBox.width / videoRef.current.videoWidth) *
            canvasRef.current.width;
          const height =
            (detection.boundingBox.height / videoRef.current.videoHeight) *
            canvasRef.current.height;

          const confidence = (detection.categories[0].score * 100).toFixed(2);

          ctx.strokeStyle = "#FF8C42";
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, width, height);

          ctx.fillStyle = "#FF3CAC";
          ctx.font = "14px Arial";
          ctx.fillText(
            `Confidence: ${confidence}%`,
            x,
            y > 20 ? y - 10 : y + 20
          );
        }
      }

      window.requestAnimationFrame(detectFaces);
    };

    detectFaces();
  };

  const takeSnapshot = () => {
    const snapshotCanvas = document.createElement("canvas");
    const context = snapshotCanvas.getContext("2d");

    snapshotCanvas.width = canvasRef.current.width;
    snapshotCanvas.height = canvasRef.current.height;

    context.drawImage(canvasRef.current, 0, 0);

    const dataUrl = snapshotCanvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "snapshot.png";
    link.click();

    console.log("Snapshot taken");
  };

  const startRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "inactive") {
      mediaRecorder.start();
      setIsRecording(true);
      console.log("Recording started");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      setIsRecording(false);
      console.log("Recording stopped");
    }
  };

  const saveRecording = () => {
    if (isRecording) {
      alert("Please stop the recording before saving.");
      return;
    }

    if (recordedChunks.length === 0) {
      alert("No recording available. Please record something first.");
      return;
    }

    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "recording.webm";
    link.click();

    console.log("Recording saved");
  };

  return (
    <div className="relative overflow-hidden flex items-center justify-center h-screen bg-gradient-to-r from-[#6A11CB] via-[#2575FC] to-[#6A11CB] cursor-default">
      <div className="absolute inset-0 z-0">
        {[...Array(50)].map((_, i) => (
          <div key={i} className={`particle-animation particle-${i % 5}`}></div>
        ))}
      </div>

      <div className="relative z-10 text-center">
        <h1 className="text-xl md:text-2xl text-white tracking-wider mb-10">
          Face Detection
        </h1>

        <div className="flex flex-col space-y-5 items-center">
          <div
            id="liveView"
            style={{ position: "relative", display: "inline-block" }}
          >
            <video
              ref={videoRef}
              style={{
                display: "block",
                width: "100%",
                height: "auto",
                position: "relative",
                zIndex: 5,
              }}
              autoPlay
            ></video>
            <canvas
              ref={canvasRef}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                zIndex: 10,
                pointerEvents: "none",
                width: "100%",
                height: "100%",
              }}
            ></canvas>
          </div>

          <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-5">
            {!isRecording && (
              <button
                onClick={startRecording}
                className="bg-gradient-to-r from-[#FF8C42] to-[#FF3CAC] text-white font-bold py-3 px-10 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-300 ease-in-out"
              >
                Start Recording
              </button>
            )}
            {isRecording && (
              <button
                onClick={stopRecording}
                className="bg-gradient-to-r from-[#FF3CAC] to-[#FF8C42] text-white font-bold py-3 px-10 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-300 ease-in-out"
              >
                Stop Recording
              </button>
            )}
            <button
              onClick={saveRecording}
              className="bg-gradient-to-r from-[#FF8C42] to-[#FF3CAC] text-white font-bold py-3 px-10 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-300 ease-in-out"
            >
              Save Recording
            </button>
            <button
              onClick={takeSnapshot}
              className="bg-gradient-to-r from-[#FF8C42] to-[#FF3CAC] text-white font-bold py-3 px-10 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-300 ease-in-out"
            >
              Take Snapshot
            </button>
            <Link
              href="/"
              className="bg-gradient-to-r from-[#FF8C42] to-[#FF3CAC] text-white font-bold py-3 px-10 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-300 ease-in-out"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
