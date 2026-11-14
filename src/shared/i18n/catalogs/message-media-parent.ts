export const en = {
  "messageMedia.allImages": "View all {count} images, starting at image 4",
  "messageMedia.allMixed":
    "View all {count} photos and videos, starting at item 4",
  "messageMedia.imageIndex": "Open image {index} of {count}",
  "messageMedia.videoIndex": "Open video {index} of {count}",
  "messageMedia.singleImage": "{count} image",
  "messageMedia.images": "{count} images",
  "messageMedia.mixed": "{count} photos and videos",
  "messageMedia.openVideo": "Open video",
} as const;

export const ko: Record<keyof typeof en, string> = {
  "messageMedia.allImages": "이미지 {count}개 모두 보기, 4번째 이미지부터",
  "messageMedia.allMixed": "사진과 동영상 {count}개 모두 보기, 4번째 항목부터",
  "messageMedia.imageIndex": "이미지 {count}개 중 {index}번째 열기",
  "messageMedia.videoIndex": "동영상 {count}개 중 {index}번째 열기",
  "messageMedia.singleImage": "이미지 {count}개",
  "messageMedia.images": "이미지 {count}개",
  "messageMedia.mixed": "사진과 동영상 {count}개",
  "messageMedia.openVideo": "동영상 열기",
};
