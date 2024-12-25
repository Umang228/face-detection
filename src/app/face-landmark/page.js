"use client";

import React, { useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import Link from "next/link";

export default function Home() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [faceLandmarker, setFaceLandmarker] = useState(null);
  const [ctx, setCtx] = useState(null);
  const [webcamRunning, setWebcamRunning] = useState(false);
  const [detectionRunning, setDetectionRunning] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    initializeFaceLandmarker();
  }, []);

  useEffect(() => {
    if (faceLandmarker) {
      startWebcam();
    }
  }, [faceLandmarker]);

  const initializeFaceLandmarker = async () => {
    try {
      const filesetResolver = await FilesetResolver.forVisionTasks("/models/wasm");
      const faceLandmarkerInstance = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: "/models/face_landmarker.task",
          delegate: "GPU",
        },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
        numFaces: 1,
      });

      setFaceLandmarker(faceLandmarkerInstance);
      console.log("FaceLandmarker initialized:", faceLandmarkerInstance);

      if (canvasRef.current) {
        const context = canvasRef.current.getContext("2d");
        setCtx(context);
        console.log("Canvas context initialized:", context);
      }
    } catch (error) {
      console.error("Error initializing FaceLandmarker:", error);
    }
  };

  const startWebcam = async () => {
    console.log("Attempting to start webcam...");
    if (!faceLandmarker) {
      alert("Face Landmarker is still loading. Please try again.");
      return;
    }
  
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      videoRef.current.style.display = "block";
      setWebcamRunning(true);
  
      // Set canvas dimensions to match video
      const videoSettings = stream.getVideoTracks()[0].getSettings();
      canvasRef.current.width = videoSettings.width || 640;
      canvasRef.current.height = videoSettings.height || 480;
  
      // Capture the canvas stream
      const canvasStream = canvasRef.current.captureStream(30); // 30 FPS
  
      const recorder = new MediaRecorder(canvasStream, { mimeType: "video/webm" });
      setMediaRecorder(recorder);
  
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setRecordedChunks((prev) => [...prev, event.data]);
        }
      };
  
      videoRef.current.addEventListener("loadeddata", () => {
        setDetectionRunning(true);
        detect();
      });
    } catch (err) {
      console.error("Error accessing webcam:", err);
    }
  };
  

  const drawLandmarks = (landmarks, ctx, color) => {
    ctx.fillStyle = color;
    ctx.lineWidth = 1;
    landmarks.forEach((landmark) => {
      const x = landmark.x * canvasRef.current.width;
      const y = landmark.y * canvasRef.current.height;
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, 1 * Math.PI);
      ctx.fill();
    });
  };

  const detect = async () => {
    if (!faceLandmarker || !ctx || !videoRef.current || !detectionRunning) return;
  
    if (
      videoRef.current.videoWidth === 0 ||
      videoRef.current.videoHeight === 0 ||
      canvasRef.current.width === 0 ||
      canvasRef.current.height === 0
    )
      return;
  
    // Draw the video feed onto the canvas as the background
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.drawImage(
      videoRef.current,
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );
  
    // Detect landmarks and draw them
    const results = faceLandmarker.detectForVideo(videoRef.current, performance.now());
    if (results.faceLandmarks && results.faceLandmarks.length > 0) {
      results.faceLandmarks.forEach((landmarks) => {
        drawLandmarks(landmarks, ctx, "#ffffff");
      });
    }
  
    if (webcamRunning) {
      requestAnimationFrame(detect);
    }
  };
  

  const takeSnapshot = () => {
    if (!canvasRef.current || !ctx) return;

    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.drawImage(
      videoRef.current,
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );

    if (faceLandmarker) {
      const results = faceLandmarker.detectForVideo(
        videoRef.current,
        performance.now()
      );

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        results.faceLandmarks.forEach((landmarks) => {
          drawLandmarks(landmarks, ctx, "#00FF00");
        });
      }
    }

    const dataUrl = canvasRef.current.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "snapshot.png";
    link.click();
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

  useEffect(() => {
    if (detectionRunning) {
      detect();
    }
  }, [detectionRunning]);

  return (
    <div className="relative overflow-hidden flex items-center justify-center h-screen bg-gradient-to-r from-[#6A11CB] via-[#2575FC] to-[#6A11CB] cursor-default">
      <div className="absolute inset-0 z-0">
        {[...Array(50)].map((_, i) => (
          <div key={i} className={`particle-animation particle-${i % 5}`}></div>
        ))}
      </div>

      <div className="relative z-10 text-center flex flex-col items-center">
        <h1 className="text-xl md:text-2xl text-white tracking-wider mb-10">
          Face Landmarker
        </h1>
        <div className="relative inline-block">
          <video
            ref={videoRef}
            id="webcam"
            style={{
              display: "none",
              width: "100%",
              height: "auto",
              position: "relative",
              zIndex: 5,
            }}
            autoPlay
            playsInline
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
        <div className="flex flex-col md:flex-row space-x-0 md:space-x-5">
          {!isRecording && (
            <button
              onClick={startRecording}
              className="bg-gradient-to-r from-[#FF8C42] to-[#FF3CAC] text-white font-bold py-3 px-10 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-300 ease-in-out mt-5"
            >
              Start Recording
            </button>
          )}
          {isRecording && (
            <button
              onClick={stopRecording}
              className="bg-gradient-to-r from-[#FF3CAC] to-[#FF8C42] text-white font-bold py-3 px-10 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-300 ease-in-out mt-5"
            >
              Stop Recording
            </button>
          )}
          <button
            onClick={saveRecording}
            className="bg-gradient-to-r from-[#FF8C42] to-[#FF3CAC] text-white font-bold py-3 px-10 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-300 ease-in-out mt-5"
          >
            Save Recording
          </button>
          <button
            onClick={takeSnapshot}
            className="bg-gradient-to-r from-[#FF8C42] to-[#FF3CAC] text-white font-bold py-3 px-10 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-300 ease-in-out mt-5"
          >
            Take Snapshot
          </button>
          <Link
              href="/"
              className="bg-gradient-to-r from-[#FF8C42] to-[#FF3CAC] text-white font-bold py-3 px-10 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition duration-300 ease-in-out mt-5"
              >
              Home
          </Link>
        </div>
      </div>
    </div>
  );
}
