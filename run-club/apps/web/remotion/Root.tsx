import { Composition } from "remotion";
import { RunStoryVideo, type RunStoryProps } from "./RunStoryVideo";

const defaultProps: RunStoryProps = {
  template: "run",
  displayName: "Demo Owner",
  handle: "owner",
  avatar: {
    skin: "#F4CCA4", hair: "#1F1A18", top: "#FF5F0E", bottom: "#222228", shoes: "#FFFDF7",
    hairStyle: "spiky", eyeStyle: "classic", topStyle: "higround", bottomStyle: "run_shorts",
    headwear: "cap", headwearColor: "#FF5F0E", accessory: "shades", accessoryColor: "#F7D046",
  },
  level: 17,
  title: "Pacer",
  totalXp: 10732,
  weekKm: 18.4,
  totalKm: 245,
  higroundStarts: 13,
  yogaStars: 10,
  caption: "Pace santai, kopi kencang di Higround!",
  badges: ["Home Base", "First 10K", "Fondasi Clear"],
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="HigroundRunStory"
    component={RunStoryVideo}
    durationInFrames={180}
    fps={30}
    width={540}
    height={960}
    defaultProps={defaultProps}
  />
);
