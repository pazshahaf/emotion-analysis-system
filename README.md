# 🎭 Emotion Analysis System for Job Interviews

This system analyzes a candidate's facial emotions during a job interview in real-time and suggests personalized follow-up questions for the interviewer, based on the detected emotional state.

---

## 🧠 Project Overview

- Real-time facial emotion recognition using a deep learning model (e.g. ResNet50 or custom CNN)
- Smart question suggestion module to guide interviewers
- Flask backend + React frontend
- Option to export emotion logs to file (CSV/Excel)

---

## 🧰 Technologies Used

- **Frontend**: React.js
- **Backend**: Flask (Python)
- **AI/ML**: TensorFlow / Keras, OpenCV
- **Visualization**: Grad-CAM, Matplotlib
- **Data Handling**: NumPy, Pandas, Pillow
- **Others**: Flask-CORS, dotenv, requests

---

### 🖥️ Terminal 1: Backend Setup

#### First Time (setup virtual environment):
```bash
cd emotion-analysis-system/backend
python3 -m venv venv
source venv/bin/activate
pip install flask flask-cors opencv-python numpy pandas pillow requests python-dotenv tensorflow
Every Time You Run:
cd emotion-analysis-system/backend
source venv/bin/activate
python app.py
Terminal 2: Frontend Setup
First Time Only:
cd emotion-analysis-system/frontend
npm install
Every Time You Run:
cd emotion-analysis-system/frontend
npm start

Contact & Credits
Developed by Paz Shahaf and Sapir Ashuruv
GitHub: @pazshahaf
https://github.com/pazshahaf/emotion-analysis-system.git
