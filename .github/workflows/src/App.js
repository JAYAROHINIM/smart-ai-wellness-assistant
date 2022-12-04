import React, { useRef } from "react";
import { useState } from 'react';
import "./App.css";
import { drawKeypoints } from "./utilities";
import Webcam from "react-webcam";
import * as poseDetection from '@tensorflow-models/pose-detection';
// Register WebGL backend.
import '@tensorflow/tfjs-backend-webgl';

function App() {
  /* 
     The app function is uses a webcam object and a canvas on top of the webcam to show the points of interest.
     The flow of the funtions are runBlazePose -> detect(net) [which calls an asynchronous function to detect the poses] -> attention(poses) [finds if the person is paying attention] and finally returns a dictionary[which is easily convertible to json for an api post]
     
     The function and variable info is written using inline comments
     
     */
  // setting the webcam Ref and canvasRef

  const webcamRef = useRef(null);
  const canvasRef = useRef(null);

  // Final dictionary to be returned
  const information = {
    "Attention percentage": 0.0,
    "Total Slouched time": 0.0,
    "Total Chin-on-hand time": 0.0,
    "Total Looking elsewhere time": 0.0,
  }
  // const [info, setinfo] = useState(information);
  // for the loading screen
  const [isVisible, setIsVisible] = useState(true);
  // declaring the variables
  var mistakes = { "CHIN-ON-HAND": 0, "SLOUCHING": 0, "Not looking at the screen": 0 };
  var positive_attention = 0.0;
  var total_attention = 0.0;
  const interval = 1000; // after how many milliseconds will the detect function be called


  // Main Blazepose function
  const runBlazePose = async () => {
    const model = poseDetection.SupportedModels.BlazePose; // defining the model
    // setting config settings for the model
    const detectorConfig = {
      runtime: 'tfjs',
      enableSmoothing: true,
      modelType: 'full'  // can be selected based on performance requirements
    };
    //makes the function wait till the model loads
    const net = await poseDetection.createDetector(model, detectorConfig);
    // the loading screen visibility is set to false once the model is loaded
    setIsVisible(false);
    // setinfo(information);
    setInterval(() => {
      detect(net);
    }, interval);
  };

  const detect = async (net) => {
    // checks if the webcam is supported
    if (
      typeof webcamRef.current !== "undefined" &&
      webcamRef.current !== null &&
      webcamRef.current.video.readyState === 4
    ) {

      // Get Video Properties
      const video = webcamRef.current.video;
      const videoWidth = webcamRef.current.video.videoWidth;
      const videoHeight = webcamRef.current.video.videoHeight;

      // Set video width
      webcamRef.current.video.width = videoWidth;
      webcamRef.current.video.height = videoHeight;

      // Set Prediction confidence
      const confidence_benchmark = 0.6;

      // Make Detections
      const estimationConfig = { flipHorizontal: true }; // webcam image is flipped
      const timestamp = performance.now();
      // predict the poses
      const poses = await net.estimatePoses(video, estimationConfig, timestamp);
      // console.log(poses[0]["keypoints"]);

      // draw the detected points
      drawCanvas(poses, video, videoWidth, videoHeight, canvasRef, confidence_benchmark);

      // attention function returns true or false
      var att = attention(poses[0]["keypoints"])
      if (att === true) {
        positive_attention += 1;
      }
      total_attention += 1;
      // calculating the percentage of positive attention (true cases)
      var att_performance = positive_attention / total_attention * 100;
      att_performance = Math.round((att_performance + Number.EPSILON) * 100) / 100;
      var attention_percentage = att_performance + "%";

      // Updating the dictionary with the latest values
      information["Attention percentage"] = attention_percentage;
      information["Total Chin-on-hand time"] = mistakes["CHIN-ON-HAND"];
      information["Total Looking elsewhere time"] = mistakes["Not looking at the screen"];
      information["Total Slouched time"] = mistakes["SLOUCHING"];

      
      console.log(information);
    }
  };

  const drawCanvas = (pose, video, videoWidth, videoHeight, canvas, confidence_benchmark) => {

    // Set the parameters
    const ctx = canvas.current.getContext("2d");
    canvas.current.width = videoWidth;
    canvas.current.height = videoHeight;

    // Draw the points on the canvas
    drawKeypoints(pose[0]["keypoints"], confidence_benchmark, ctx);
  };

  const attention = (pose) => {

    /* This function has 3 cases
    1) Not looking at the screen
    2) Slouching
    3) Chin on hand
    
    The function calculates each possibility individually and updates the mistake dictionary which is a global variable    
    */

    // calculate the base height of the shoulder and lip
    const shoulder_height = (pose[12]["y"] + pose[11]["y"]) / 2;
    const lip_height = (pose[10]["y"] + pose[9]["y"]) / 2;

    // calculate the distance between the nose and lip and shoulder and lip (will be used in ratios)
    const nose_lip = Math.abs(lip_height - pose[0]["y"]);
    const lip_shoulder = Math.abs(shoulder_height - lip_height);

    // r_ear_nose -> right ear to nose x distance  l_ear_nose -> left ear to nose x distance 
    const r_ear_nose = Math.abs(pose[8]["x"] - pose[0]["x"]);
    const l_ear_nose = Math.abs(pose[7]["x"] - pose[0]["x"]);
    const mid_lip_x = Math.abs(pose[9]["x"] + pose[10]["x"]) / 2; // mean x lip coordinate
    const mid_lip_y = Math.abs(pose[9]["y"] + pose[10]["y"]) / 2; // mean y lip coordinate

    // r_hand_lip_x -> right hand to lip x distance (other variables are similarly named)
    const r_hand_lip_x = Math.abs(mid_lip_x - pose[16]["x"]);
    const l_hand_lip_x = Math.abs(mid_lip_x - pose[15]["x"]);
    const r_hand_lip_y = Math.abs(mid_lip_y - pose[16]["y"]);
    const l_hand_lip_y = Math.abs(mid_lip_y - pose[15]["y"]);

    // ratio of distance from (nose -> lip) : (lip -> any wrist) used for calculating chin on hand
    const chin_on_hand_ratio = 5.0;

    // default value of the attention, if none of the cases are true, the person is paying attention
    var attention = true;

    // If checks if the person is turning left or right by checking the ratio of ear to nose
    if ((r_ear_nose * 1.0) / l_ear_nose > 1.5 || (l_ear_nose * 1.0) / r_ear_nose > 1.5) {
      attention = false;
      mistakes["Not looking at the screen"] += 1;
    }

    // checks if the person is slouching by comparing the distance of lip shoulder and lip nose
    if ((lip_shoulder * 1.0) / nose_lip < 2.2) {
      attention = false;
      mistakes["SLOUCHING"] += 1;
    }

    // checks the ratio of distance from lip wrist to lip nose for chin on hand case
    if ((r_hand_lip_x < nose_lip * chin_on_hand_ratio && r_hand_lip_y < nose_lip * chin_on_hand_ratio) || (l_hand_lip_x < nose_lip * chin_on_hand_ratio && l_hand_lip_y < nose_lip * chin_on_hand_ratio)) {
      attention = false;
      mistakes["CHIN-ON-HAND"] += 1;
    }

    return attention;
  }


  runBlazePose();

  return (
    <div className="App">
      <div style={{ visibility: isVisible ? 'visible' : 'hidden' }}>
        <h2>Loading the model</h2>
      </div>
      <header className="App-header">
        <Webcam
          ref={webcamRef}
          style={{
            position: "absolute",
            marginLeft: "auto",
            marginRight: "auto",
            left: 0,
            right: 0,
            textAlign: "center",
            zindex: 9,
            width: 640,
            height: 480,
          }}
        />

        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            marginLeft: "auto",
            marginRight: "auto",
            left: 0,
            right: 0,
            textAlign: "center",
            zindex: 9,
            width: 640,
            height: 480,
          }}
        />
      </header>
      {/* <div>
        Attention Percentage {info["Attention percentage"]}
        Chin on Hand {info["Total Chin-on-hand time"]}
        Looking Elsewhere{info["Total Looking elsewhere time"]}
        Total Slouched time{info["Total Slouched time"]}
      </div> */}
    </div>
    
  );
}

export default App;
