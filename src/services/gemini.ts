import { GoogleGenAI, Type } from "@google/genai";
import { BookConfig, StoryBook } from "../types";

function getApiKey() {
  try {
    return process.env.GEMINI_API_KEY || localStorage.getItem('GEMINI_API_KEY') || "";
  } catch (e) {
    return localStorage.getItem('GEMINI_API_KEY') || "";
  }
}

export async function generateStoryStructure(config: BookConfig): Promise<StoryBook> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const model = "gemini-flash-lite-latest";
  
  const prompt = `สร้างโครงสร้างนิทานสำหรับเด็กอายุ ${config.targetAge} ปี 
  แนวเรื่อง: ${config.genre}
  จำนวนหน้า: ${config.pageCount} หน้า
  ตัวละครหลัก: ${config.mainCharacterDesc}
  เพิ่มเติม: ${config.additionalNotes}
  
  กรุณาตอบกลับเป็น JSON ตามโครงสร้างที่กำหนด โดยต้องมี:
  1. title: ชื่อเรื่องที่น่าสนใจ
  2. characterVisualProfile: คำอธิบายลักษณะทางกายภาพของตัวละครหลักอย่างละเอียด (เพื่อความคงที่ของภาพ)
  3. frontCover: ชื่อเรื่องและ imagePrompt สำหรับหน้าปก
  4. pages: รายการหน้า (pageNumber, text, imagePrompt) จำนวน ${config.pageCount} หน้า
  5. backCover: ข้อความส่งท้ายและ imagePrompt สำหรับปกหลัง
  
  หมายเหตุ: imagePrompt ต้องเป็นภาษาอังกฤษและอธิบายสไตล์ ${config.artStyle} อย่างชัดเจน`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          characterVisualProfile: { type: Type.STRING },
          frontCover: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              imagePrompt: { type: Type.STRING }
            },
            required: ["title", "imagePrompt"]
          },
          pages: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                pageNumber: { type: Type.INTEGER },
                text: { type: Type.STRING },
                imagePrompt: { type: Type.STRING }
              },
              required: ["pageNumber", "text", "imagePrompt"]
            }
          },
          backCover: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              imagePrompt: { type: Type.STRING }
            },
            required: ["text", "imagePrompt"]
          }
        },
        required: ["title", "characterVisualProfile", "frontCover", "pages", "backCover"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateImage(prompt: string, aspectRatio: "1:1" | "3:4" | "4:3", retries = 3): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const model = "gemini-2.5-flash-image";
  
  // Add a small initial delay to help stay under 5 RPM (12s per request)
  await delay(2000);

  for (let i = 0; i < retries; i++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [{ text: prompt }]
        },
        config: {
          imageConfig: {
            aspectRatio
          }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      
      // If no image data but no error, it might be a safety filter
      if (response.candidates?.[0]?.finishReason === 'SAFETY') {
        throw new Error("SAFETY_FILTER: เนื้อหาภาพถูกระงับเนื่องจากนโยบายความปลอดภัย ลองปรับคำอธิบายตัวละครใหม่");
      }

    } catch (error: any) {
      const errorMsg = error.message || error.toString();
      const isQuotaError = errorMsg.includes('quota') || errorMsg.includes('429') || errorMsg.includes('limit');
      
      console.warn(`Image generation attempt ${i + 1} failed:`, errorMsg);
      
      if (i === retries - 1) throw error;
      
      // If it's a rate limit error, wait much longer to reset the 1-minute window
      const waitTime = isQuotaError ? 15000 * (i + 1) : 3000 * (i + 1);
      await delay(waitTime);
    }
  }
  
  throw new Error("Failed to generate image after retries");
}
