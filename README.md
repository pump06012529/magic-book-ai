# Magic Book Builder 🪄📖

ระบบสร้างนิทานอัจฉริยะด้วย AI (Gemini API) ที่ช่วยให้คุณสร้างนิทานพร้อมภาพประกอบได้ในไม่กี่นาที

## วิธีการติดตั้งและใช้งาน (Local Development)

1. **Clone Repository**
   ```bash
   git clone <your-repo-url>
   cd magic-book-builder
   ```

2. **ติดตั้ง Dependencies**
   ```bash
   npm install
   ```

3. **ตั้งค่า Environment Variables**
   สร้างไฟล์ `.env` และเพิ่ม Gemini API Key:
   ```env
   VITE_GEMINI_API_KEY=your_api_key_here
   ```

4. **เริ่มใช้งาน**
   ```bash
   npm run dev
   ```

## การนำไปใช้งานบน GitHub Pages

โปรเจกต์นี้รองรับการ Deploy ไปยัง GitHub Pages โดยอัตโนมัติผ่าน GitHub Actions:

1. นำโค้ดขึ้น GitHub Repository
2. ไปที่แท็บ **Settings** > **Pages**
3. ในส่วน **Build and deployment** > **Source** ให้เลือกเป็น **GitHub Actions**
4. เมื่อมีการ Push โค้ดไปยังกิ่ง `main` ระบบจะทำการ Deploy ให้โดยอัตโนมัติ

### หมายเหตุเรื่องความปลอดภัย
หากคุณ Deploy ไปยัง GitHub Pages (ซึ่งเป็น Static Hosting):
- แอปพลิเคชันจะถามหา API Key จากผู้ใช้งานโดยตรง (หากไม่ได้รันใน Google AI Studio)
- หรือคุณสามารถตั้งค่า `VITE_GEMINI_API_KEY` ใน GitHub Secrets เพื่อ Build ลงไปในแอป (ไม่แนะนำสำหรับคีย์ที่เป็นความลับ)

## เทคโนโลยีที่ใช้
- **React 19** + **TypeScript**
- **Vite** (Build Tool)
- **Tailwind CSS 4** (Styling)
- **Motion** (Animations)
- **Google Gemini API** (AI Story & Image Generation)
