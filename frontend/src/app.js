// src/App.js - the main React UI file with the fixes
import React, { useState, useEffect, useRef, Component } from 'react';
import './app.css';

// A class component to address the problem of focus and refreshment
class ExportReportFormModal extends Component {
  constructor(props) {
    super(props);
    this.state = {
      reportData: {
        candidateName: '',
        position: '',
        interviewer: '',
        notes: ''
      }
    };
    
    // Creating listeners for events
    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleGenerateReport = this.handleGenerateReport.bind(this);
  }
  
  // Handling Form Changes
  handleInputChange(e) {
    const { name, value } = e.target;
    this.setState(prevState => ({
      reportData: {
        ...prevState.reportData,
        [name]: value
      }
    }));
  }
  
  // Submit the form
  handleGenerateReport() {
    if (!this.state.reportData.candidateName || !this.state.reportData.position) {
      alert('נא למלא את שם המועמד והמשרה');
      return;
    }
    
    // call to the original function that produces the report with the local data
    this.props.onGenerateReport(this.state.reportData);
  }
  
  // Autofocus when the component is loaded
  componentDidMount() {
    if (this.candidateNameInput) {
      this.candidateNameInput.focus();
    }
  }

  render() {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <h3>הפקת דוח ראיון</h3>
          <div className="modal-form">
            <div className="form-group">
              <label htmlFor="candidateName">שם המועמד:</label>
              <input
                ref={(input) => { this.candidateNameInput = input; }}
                type="text"
                id="candidateName"
                name="candidateName"
                value={this.state.reportData.candidateName}
                onChange={this.handleInputChange}
                placeholder="הזן את שם המועמד"
              />
            </div>
            <div className="form-group">
              <label htmlFor="position">משרה:</label>
              <input
                type="text"
                id="position"
                name="position"
                value={this.state.reportData.position}
                onChange={this.handleInputChange}
                placeholder="הזן את שם המשרה"
              />
            </div>
            <div className="form-group">
              <label htmlFor="interviewer">שם המראיין:</label>
              <input
                type="text"
                id="interviewer"
                name="interviewer"
                value={this.state.reportData.interviewer || ''}
                onChange={this.handleInputChange}
                placeholder="הזן את שם המראיין"
              />
            </div>
            <div className="form-group">
              <label htmlFor="notes">הערות:</label>
              <textarea
                id="notes"
                name="notes"
                value={this.state.reportData.notes || ''}
                onChange={this.handleInputChange}
                placeholder="הערות נוספות לגבי הראיון (אופציונלי)"
                rows="3"
              />
            </div>
            <div className="modal-actions">
              <button 
                type="button"
                className="modal-btn cancel-btn" 
                onClick={this.props.onClose}
              >
                ביטול
              </button>
              <button 
                type="button"
                className="modal-btn confirm-btn" 
                onClick={this.handleGenerateReport}
              >
                הורד דוח אקסל
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

// Separate question component to reduce unnecessary refresh
const QuestionComponent = React.memo(({ questionData, onAsked, onSkipped }) => {
  if (!questionData) return null;
  
  return (
    <div className="suggested-question">
      <h3>שאלה מוצעת למראיין 
        <span className={questionData.category === 'Positive Emotion' ? 'category-tag-positive' : 'category-tag-negative'}>
          ({questionData.category === 'Positive Emotion' ? 'לרגש חיובי' : 'לרגש שלילי'})
        </span>
      </h3>
      <div className="question-box">
        {questionData.question}
      </div>
      <div className="question-actions">
        <button 
          className="question-action-btn ask-btn"
          onClick={onAsked}
        >
          סמן כנשאלה
        </button>
        <button 
          className="question-action-btn skip-btn"
          onClick={onSkipped}
        >
          דלג
        </button>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // React.memo with custom comparison function
  // Returns true if no re-rendering is needed (same question)
  if (!prevProps.questionData && !nextProps.questionData) return true;
  if (!prevProps.questionData || !nextProps.questionData) return false;
  
  // We will check if the question has changed (according to the unique ID)
  return prevProps.questionData.id === nextProps.questionData.id;
});
function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [emotionData, setEmotionData] = useState(null);
  // New status for question data that will be updated separately
  const [questionData, setQuestionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [reportData, setReportData] = useState({
    candidateName: '',
    position: '',
    interviewer: '',
    notes: ''
  });
  
  // Variables for managing question presentation - with state
  const [lastEmotion, setLastEmotion] = useState(null);
  const [shouldShowNewQuestion, setShouldShowNewQuestion] = useState(true);
  const [lastQuestionTime, setLastQuestionTime] = useState(Date.now());
  const [updateCount, setUpdateCount] = useState(0);
  
  // References for managing question submissions - similar to state but updated immediately 
  const lastEmotionRef = useRef(null);
  const shouldShowNewQuestionRef = useRef(true);
  const lastQuestionTimeRef = useRef(Date.now());
  const updateCountRef = useRef(0);
  const lastQuestionDataRef = useRef(null); // Reference to save the last question

  // More references
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const captureTimerRef = useRef(null);
  const isRecordingRef = useRef(false);
  const questionTimerRef = useRef(null);
  
  // Time constants
  const captureInterval = 4; // שניות בין צילומים
  const questionInterval = 30 * 1000; // 30 שניות במילישניות בין שאלות באותו רגש
  
  const resetInterview = () => {
    try {
      console.log("מאפס ראיון...");
      fetch('http://localhost:5001/api/reset-interview', {
        method: 'POST'
      })
      .then(response => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('תקלה באיפוס הראיון');
      })
      .then(data => {
        console.log("הראיון אופס בהצלחה:", data);
        
        // Reset question data and history
        setQuestionData(null);
        lastQuestionDataRef.current = null;
        setHistory([]);
        
        // reset emotional states
        setLastEmotion(null);
        lastEmotionRef.current = null;
        
        // Setting to display a new question on the next shot
        setShouldShowNewQuestion(true);
        shouldShowNewQuestionRef.current = true;
        
        alert('הראיון אופס בהצלחה, השאלה הבאה תהיה שאלת פתיחה');
      })
      .catch(error => {
        console.error("שגיאה באיפוס הראיון:", error);
        alert('אירעה שגיאה באיפוס הראיון: ' + error.message);
      });
    } catch (error) {
      console.error("שגיאה באיפוס הראיון:", error);
      alert('אירעה שגיאה באיפוס הראיון');
    }
  };
  
  const startScreenCapture = async () => {
    try {
      setError(null);
      
      console.log("מתחיל תהליך בקשת צילום מסך...");
      // Request for media input - screenshot
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false
      });
      
      mediaStreamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        videoRef.current.onloadedmetadata = () => {
          console.log("הווידאו נטען בהצלחה, מפעיל הקלטה...");
          // Updating the ref and status together
          isRecordingRef.current = true;
          setIsRecording(true);
          
          // Reset question status when starting a new recording - update state and refs
          setLastEmotion(null);
          lastEmotionRef.current = null;
          
          setShouldShowNewQuestion(true);
          shouldShowNewQuestionRef.current = true;
          
          setQuestionData(null); // Reset loan data
          lastQuestionDataRef.current = null;
          
          const currentTime = Date.now();
          setLastQuestionTime(currentTime);
          lastQuestionTimeRef.current = currentTime;
          
          setUpdateCount(0);
          updateCountRef.current = 0;
          
          // We will wait a little before starting the timer to take pictures.
          setTimeout(() => {
            if (isRecordingRef.current) {
              console.log("מפעיל טיימר לצילום...");
              startCaptureTimer();
            }
          }, 1000);
        };
        
        // Add a listener for the screenshot to end
        stream.getVideoTracks()[0].onended = () => {
          console.log("צילום המסך הופסק על ידי המשתמש");
          stopScreenCapture();
        };
      }
    } catch (err) {
      console.error('שגיאה בהפעלת צילום מסך:', err);
      setError('לא ניתן להפעיל צילום מסך: ' + err.message);
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  };

  const stopScreenCapture = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (captureTimerRef.current) {
      clearInterval(captureTimerRef.current);
      captureTimerRef.current = null;
    }
    
    if (questionTimerRef.current) {
      clearTimeout(questionTimerRef.current);
      questionTimerRef.current = null;
    }
    
    isRecordingRef.current = false;
    setIsRecording(false);
    
    // Resetting the question state when stopping recording - updating state and refs
    setLastEmotion(null);
    lastEmotionRef.current = null;
    
    setShouldShowNewQuestion(true);
    shouldShowNewQuestionRef.current = true;
    
    setQuestionData(null); // Reset loan data
    lastQuestionDataRef.current = null;
    
    const currentTime = Date.now();
    setLastQuestionTime(currentTime);
    lastQuestionTimeRef.current = currentTime;
    
    setUpdateCount(0);
    updateCountRef.current = 0;
  };
  
  // Screenshot capture timer
  const startCaptureTimer = () => {
    // Clear previous timer if present
    if (captureTimerRef.current) {
      clearInterval(captureTimerRef.current);
      captureTimerRef.current = null;
    }
    
    if (!isRecordingRef.current || !videoRef.current || !videoRef.current.srcObject) {
      console.log("לא ניתן להפעיל טיימר: אין הקלטה פעילה או וידאו זמין");
      return;
    }
    
    console.log("מפעיל טיימר לצילום תמונות כל", captureInterval, "שניות");
    console.log("שאלות חדשות יוצגו רק אחרי שינוי רגש או", questionInterval / 1000, "שניות");
    
    // Instant First Shot - Always shows a question the first time
    setTimeout(() => {
      if (isRecordingRef.current) {
        captureScreenshot();
      }
    }, 500);
    
    captureTimerRef.current = setInterval(() => {
      if (!isRecordingRef.current || !videoRef.current || !videoRef.current.srcObject) {
        console.log("מבטל טיימר צילום: אין הקלטה פעילה");
        clearInterval(captureTimerRef.current);
        captureTimerRef.current = null;
        return;
      }
      
      console.log("מבצע צילום תקופתי...");
      captureScreenshot();
    }, captureInterval * 1000);
  };

  // Photography and image analysis
  const captureScreenshot = async () => {
    if (!videoRef.current || !canvasRef.current || !isRecordingRef.current) {
      console.log("צילום לא אפשרי: וידאו או קנבס לא זמינים או הקלטה לא פעילה");
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Adjusting the canvas size to the video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw the current image on the canvas.
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    try {
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      console.log("תמונה נוצרה בהצלחה, גודל:", imageData.length);
      
      // Sending the image to the server for analysis
      await analyzeImage(imageData);
      
    } catch (err) {
      console.error('שגיאה בצילום תמונה:', err);
      setError('שגיאה בצילום תמונה: ' + err.message);
    }
  };
  const analyzeImage = async (imageData) => {
    try {
      console.log("מתחיל ניתוח תמונה...");
      setLoading(true);
      
      // Checking that the server is available
      try {
        const serverCheckResponse = await fetch('http://localhost:5001/api/analyze', {
          method: 'HEAD'
        });
        console.log("בדיקת זמינות שרת:", serverCheckResponse.status);
      } catch (checkErr) {
        console.error("השרת לא זמין:", checkErr);
        setError("השרת לא זמין. ודא שהשרת (app.py) רץ על פורט 5001");
        setLoading(false);
        return;
      }
      
      console.log("שולח נתוני תמונה לשרת...");
      
      const formData = new FormData();
      formData.append('image', imageData);
      
      const response = await fetch('http://localhost:5001/api/analyze', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`שגיאת שרת: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      //Update sentiment data in any case - refreshes every 4 seconds
      setEmotionData({
        classified_emotion: data.classified_emotion,
        confidence: data.confidence,
        category: data.category,
        detected_emotions: data.detected_emotions
      });
      
      // Checking whether to display a new question - use refs instead of state
      const currentTime = Date.now();
      const currentEmotion = data.classified_emotion;
      const timeSinceLastQuestion = currentTime - lastQuestionTimeRef.current;
      
      console.log(`=== סטטוס עדכון שאלה ===`);
      console.log(`רגש נוכחי: ${currentEmotion}, רגש קודם: ${lastEmotionRef.current === null ? 'אין' : lastEmotionRef.current}`);
      console.log(`זמן מאז השאלה האחרונה: ${Math.floor(timeSinceLastQuestion / 1000)} שניות מתוך ${questionInterval / 1000} נדרשות`);
      console.log(`דגל שאלה חדשה: ${shouldShowNewQuestionRef.current ? 'פעיל' : 'לא פעיל'}`);
      console.log(`מספר עדכון: ${updateCountRef.current}`);
      
      let shouldUpdate = false;
      
      // If there is no previous emotion (first time)
      if (lastEmotionRef.current === null) {
        shouldUpdate = true;
        console.log("✅ מציג שאלה - רגש ראשון בניתוח");
      } 
      // If the emotion is different from before
      else if (lastEmotionRef.current !== currentEmotion) {
        shouldUpdate = true;
        console.log(`✅ מציג שאלה - הרגש השתנה מ-${lastEmotionRef.current} ל-${currentEmotion}`);
      }
      // If 30 seconds or more have passed
      else if (timeSinceLastQuestion >= questionInterval) {
        shouldUpdate = true;
        console.log(`✅ מציג שאלה - עברו ${Math.floor(timeSinceLastQuestion / 1000)} שניות באותו רגש`);
      }
      // If the user marked a question as asked or skipped
      else if (shouldShowNewQuestionRef.current) {
        shouldUpdate = true;
        console.log("✅ מציג שאלה - השאלה הקודמת סומנה כנשאלה או דולגה");
      }
      // Otherwise, no new question is presented.
      else {
        console.log(`❌ לא מציג שאלה חדשה - עדיין אותו רגש (${currentEmotion}) ועברו רק ${Math.floor(timeSinceLastQuestion / 1000)} שניות`);
      }
      
      // The latest emotion update (in state and ref)
      setLastEmotion(currentEmotion);
      lastEmotionRef.current = currentEmotion;
      
      // Update counter (in state and ref)
      setUpdateCount(prevCount => {
        const newCount = prevCount + 1;
        updateCountRef.current = newCount;
        return newCount;
      });
      
      // If the question needs to be updated (only in cases of change)
      if (shouldUpdate) {
        // Creating the new question object
        const newQuestionData = {
          question: data.suggested_question,
          category: data.category,
          timestamp: new Date().toLocaleTimeString(),
          id: Date.now() // Unique ID for the question
        };
        
        // Updating the status and reference of the question
        setQuestionData(newQuestionData);
        lastQuestionDataRef.current = newQuestionData;
        
        // Add to history
        setHistory(prev => [{ 
          timestamp: new Date().toLocaleTimeString(), 
          ...data, 
          asked: false, 
          skipped: false 
        }, ...prev].slice(0, 10));
        
        // Update the last question time (in state and ref)
        setLastQuestionTime(currentTime);
        lastQuestionTimeRef.current = currentTime;
        
        // Reset the flag (in state and ref)
        setShouldShowNewQuestion(false);
        shouldShowNewQuestionRef.current = false;
        
        // Reset and set a new timer
        if (questionTimerRef.current) {
          clearTimeout(questionTimerRef.current);
        }
        
        questionTimerRef.current = setTimeout(() => {
          console.log(`טיימר הסתיים אחרי ${questionInterval / 1000} שניות, מאפשר שאלה חדשה בצילום הבא`);
          setShouldShowNewQuestion(true);
          shouldShowNewQuestionRef.current = true;
        }, questionInterval);
      }
    
    } catch (err) {
      console.error('שגיאה בניתוח התמונה:', err);
      setError('שגיאה בניתוח התמונה: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionAsked = () => {
    // עדכון בהיסטוריה
    setHistory(prev => prev.map((item, idx) => 
      idx === 0 ? { ...item, asked: true } : item
    ));
    
    console.log("שאלה סומנה כנשאלה, מפעיל דגל לשאלה חדשה");
    
    // Turns on the flag (in state and ref)
    setShouldShowNewQuestion(true);
    shouldShowNewQuestionRef.current = true;
    
    // Clear the existing timer if any
    if (questionTimerRef.current) {
      clearTimeout(questionTimerRef.current);
      questionTimerRef.current = null;
    }
  };
  
  const handleQuestionSkipped = () => {
    // Update in history
    setHistory(prev => prev.map((item, idx) => 
      idx === 0 ? { ...item, skipped: true } : item
    ));
    
    console.log("שאלה סומנה כדולגה, מפעיל דגל לשאלה חדשה");
    
    // Turns on the flag (in state and ref)
    setShouldShowNewQuestion(true);
    shouldShowNewQuestionRef.current = true;
    
    // Clear the existing timer if any
    if (questionTimerRef.current) {
      clearTimeout(questionTimerRef.current);
      questionTimerRef.current = null;
    }
  };
  // Functions for handling the report model
  const handleOpenExportModal = () => {
    setIsExportModalOpen(true);
  };

  const handleCloseExportModal = () => {
    setIsExportModalOpen(false);
  };

  // Corrected function for defining the report data and creating the report
  const handleGenerateExcelReport = (formData) => {
    if (!formData.candidateName || !formData.position) {
      alert('נא למלא את שם המועמד והמשרה');
      return;
    }

    // Creating the Excel report
    try {
      // Saving the form data in the state before creating the report
      setReportData(formData);
      
      // A short wait to ensure that the state is updated before continuing the process
      setTimeout(() => {
        import('xlsx').then(XLSX => {
          // Preparing the data for the report
          const reportRows = history.map((item, index) => ({
            'מס׳': index + 1,
            'שעה': item.timestamp,
            'רגש': getEmotionNameHebrew(item.classified_emotion),
            'רמת ביטחון': `${(item.confidence * 100).toFixed(1)}%`,
            'קטגוריה': item.category === 'Positive Emotion' ? 'רגש חיובי' : 'רגש שלילי',
            'שאלה מוצעת': item.suggested_question,
            'סטטוס': item.asked ? 'נשאלה' : (item.skipped ? 'דולגה' : 'לא טופלה')
          }));

          // Additional information in the report - First table: Interview details
          const interviewDate = new Date().toLocaleDateString('he-IL', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          
          const interviewTime = new Date().toLocaleTimeString('he-IL', {
            hour: '2-digit',
            minute: '2-digit'
          });
          
          const summaryInfo = [
            { 'פרטי הראיון': '' },
            { 'פרטי הראיון': 'ערך' },
            { 'פרטי הראיון': 'שם המועמד', 'ערך': formData.candidateName },
            { 'פרטי הראיון': 'משרה', 'ערך': formData.position },
            { 'פרטי הראיון': 'מראיין', 'ערך': formData.interviewer || 'לא צוין' },
            { 'פרטי הראיון': 'תאריך', 'ערך': interviewDate },
            { 'פרטי הראיון': 'שעה', 'ערך': interviewTime },
            { 'פרטי הראיון': '' },
          ];
          
          // Add comments if any
          if (formData.notes && formData.notes.trim()) {
            summaryInfo.push(
              { 'פרטי הראיון': 'הערות', 'ערך': formData.notes }
            );
          }
          
          // Insert a blank line
          summaryInfo.push({ 'פרטי הראיון': '' });
          summaryInfo.push({ 'פרטי הראיון': 'סיכום רגשות', 'ערך': '' });
          
          // Calculating emotion summary
          const emotionCounts = history.reduce((acc, item) => {
            const emotion = item.classified_emotion;
            acc[emotion] = (acc[emotion] || 0) + 1;
            return acc;
          }, {});

          // Add custom columns with more structured data
          const emotionSummary = [
            { 'רגש': 'רגש', 'מספר': 'מספר הופעות', 'אחוז': 'אחוז מהראיון' }
          ];
          
          Object.entries(emotionCounts).forEach(([emotion, count]) => {
            emotionSummary.push({
              'רגש': getEmotionNameHebrew(emotion),
              'מספר': count,
              'אחוז': `${((count / history.length) * 100).toFixed(1)}%`
            });
          });
          
          // Adding positive/negative category summary
          const positiveCount = history.filter(item => item.category === 'Positive Emotion').length;
          const negativeCount = history.filter(item => item.category === 'Negative Emotion').length;
          
          emotionSummary.push({ 'רגש': '' });
          emotionSummary.push({
            'רגש': 'סה"כ רגשות חיוביים',
            'מספר': positiveCount,
            'אחוז': `${((positiveCount / history.length) * 100).toFixed(1)}%`
          });
          emotionSummary.push({
            'רגש': 'סה"כ רגשות שליליים',
            'מספר': negativeCount,
            'אחוז': `${((negativeCount / history.length) * 100).toFixed(1)}%`
          });
          
          // Create an Excel sheet
          const wb = XLSX.utils.book_new();
          
          // Main Page - History of Emotions
          const mainWS = XLSX.utils.json_to_sheet(reportRows);
          XLSX.utils.book_append_sheet(wb, mainWS, "היסטוריית רגשות");
          
          // Summary sheet
          const summaryWS = XLSX.utils.json_to_sheet(summaryInfo, { skipHeader: true });
          
          // Adding a separate table of emotions summary
          const emotionSummaryPos = summaryInfo.length + 2;
          XLSX.utils.sheet_add_json(summaryWS, emotionSummary, { 
            origin: { r: emotionSummaryPos, c: 0 }, 
            skipHeader: true 
          });
          
          // Format columns with appropriate width
          const columnWidths = [
            { wch: 20 }, // To the interview details column
            { wch: 35 }  // To the value column
          ];
          summaryWS['!cols'] = columnWidths;
          
          XLSX.utils.book_append_sheet(wb, summaryWS, "סיכום ראיון");
          
          // Saving the file
          const filename = `ניתוח_ראיון_${formData.candidateName.replace(/\s+/g, '_')}_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`;
          XLSX.writeFile(wb, filename);
          
          // Close the model
          handleCloseExportModal();
        }).catch(error => {
          console.error('שגיאה בטעינת ספריית XLSX:', error);
          alert('אירעה שגיאה ביצירת הדוח');
        });
      }, 100); // 100 milliseconds wait for status update
    } catch (error) {
      console.error('שגיאה ביצירת דוח אקסל:', error);
      alert('אירעה שגיאה ביצירת הדוח');
    }
  };

  // The updated model function that uses the class component
  const ExportReportModal = () => {
    if (!isExportModalOpen) return null;
    
    // Wrapper function for producing the report
    const handleGenerateExcelWrapper = (formData) => {
      // call to the modified function
      handleGenerateExcelReport(formData);
    };
    
    return (
      <ExportReportFormModal
        onClose={handleCloseExportModal}
        onGenerateReport={handleGenerateExcelWrapper}
      />
    );
  };

  // Cleanup when exiting the component
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (captureTimerRef.current) {
        clearInterval(captureTimerRef.current);
      }
      if (questionTimerRef.current) {
        clearTimeout(questionTimerRef.current);
      }
    };
  }, []);

  // Monitor for state and refs updates
  useEffect(() => {
    console.log("מצב עודכן:", {
      lastEmotion, 
      shouldShowNewQuestion, 
      updateCount, 
      lastQuestionTimeDisplay: new Date(lastQuestionTime).toLocaleTimeString(),
      // Information about refs
      lastEmotionRef: lastEmotionRef.current,
      shouldShowNewQuestionRef: shouldShowNewQuestionRef.current,
      lastQuestionTimeRefDisplay: new Date(lastQuestionTimeRef.current).toLocaleTimeString(),
      updateCountRef: updateCountRef.current
    });
  }, [lastEmotion, shouldShowNewQuestion, updateCount, lastQuestionTime]);
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Emotion Recognition and Language Model Integration for Adaptive Job
        Interview Assistance</h1>
      </header>

      <div className="controls-section">
        <div className="recording-controls">
          {!isRecording ? (
            <button 
              className="start-button"
              onClick={startScreenCapture}
              disabled={loading}
            >
              התחל צילום מסך
            </button>
          ) : (
            <button 
              className="stop-button"
              onClick={stopScreenCapture}
              disabled={loading}
            >
              הפסק צילום מסך
            </button>
          )}
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        <div className="debug-controls">
          <button 
            onClick={() => {
              console.log("בדיקת השרת...");
              fetch('http://localhost:5001/api/analyze', {
                method: 'HEAD'
              })
              .then(response => {
                console.log("תשובה מהשרת:", response.status, response.statusText);
                alert(`השרת זמין! סטטוס: ${response.status}`);
              })
              .catch(error => {
                console.error("שגיאה בבדיקת השרת:", error);
                alert(`השרת לא זמין: ${error.message}`);
              });
            }}
            className="debug-btn"
          >
            בדוק חיבור לשרת
          </button>
          <button 
            onClick={resetInterview}
            className="debug-btn reset-btn"
          >
            אפס ראיון
          </button>
          <button 
            onClick={handleOpenExportModal}
            className="debug-btn export-btn"
            disabled={history.length === 0}
          >
            הפק דוח לאקסל
          </button>
        </div>
      </div>
      
      {/* The new question area - above the main content area */}
      <div className="question-section">
        {/* Use the memeized component for the question */}
        <QuestionComponent 
          questionData={questionData} 
          onAsked={handleQuestionAsked} 
          onSkipped={handleQuestionSkipped}
        />
      </div>

      <div className="content-section">
        <div className="video-container">
          <h2>צילום מסך</h2>
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            className="screen-video"
          />
          <canvas 
            ref={canvasRef} 
            style={{ display: 'none' }}
          />
        </div>

        <div className="analysis-container">
          <h2>ניתוח רגשות</h2>
          
          {loading && (
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>מנתח את התמונה...</p>
            </div>
          )}
          
          {emotionData && !loading && (
            <div className="emotion-results">
              {/* This section updates every 4 seconds - emotions data */}
              <div className="emotion-summary">
                <h3>רגש שזוהה: <span className={`emotion-${emotionData.classified_emotion}`}>
                  {getEmotionNameHebrew(emotionData.classified_emotion)}
                </span></h3>
                <p>רמת ביטחון: {(emotionData.confidence * 100).toFixed(1)}%</p>
                <p>קטגוריה: <span className={emotionData.category === 'Positive Emotion' ? 'category-positive' : 'category-negative'}>
                  {emotionData.category === 'Positive Emotion' ? 'רגש חיובי' : 'רגש שלילי'}
                </span></p>
              </div>
              
              {/* This section updates every 4 seconds - Details of emotions */}
              <div className="emotion-details">
                <h3>פירוט הרגשות שזוהו:</h3>
                <div className="emotion-bars">
                  {Object.entries(emotionData.detected_emotions).map(([emotion, value]) => (
                    <div className="emotion-bar-item" key={emotion}>
                      <div className="emotion-name">{getEmotionNameHebrew(emotion)}</div>
                      <div className="emotion-bar-container">
                        <div 
                          className={`emotion-bar emotion-${emotion}`} 
                          style={{ width: `${value * 100}%` }}
                        ></div>
                      </div>
                      <div className="emotion-value">{(value * 100).toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {!emotionData && !loading && (
            <div className="no-data">
              <p>אין עדיין נתוני ניתוח. התחל צילום מסך כדי לקבל ניתוח רגשות.</p>
            </div>
          )}
        </div>
      </div>

      <div className="history-section">
        <h2>היסטוריית ניתוח</h2>
        {history.length > 0 ? (
          <div className="history-list">
            {history.map((item, index) => (
              <div className="history-item" key={index}>
                <div className="history-time">{item.timestamp}</div>
                <div className={`history-emotion emotion-${item.classified_emotion}`}>
                  {getEmotionNameHebrew(item.classified_emotion)} 
                  ({(item.confidence * 100).toFixed(1)}%)
                </div>
                <div className="history-question">
                  <strong>שאלה:</strong> {item.suggested_question}
                </div>
                <div className="history-status">
                  {item.asked && <span className="status-asked">נשאלה ✓</span>}
                  {item.skipped && <span className="status-skipped">דולגה ✗</span>}
                  {!item.asked && !item.skipped && <span className="status-pending">ממתינה</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>אין עדיין היסטוריית ניתוח.</p>
        )}
      </div>

      <footer className="app-footer">
        <p> Adaptive Job Interview Assistant Powered by Emotion and Language Intelligence &copy; 2025</p>
      </footer>
      
      <ExportReportModal />
    </div>
  );
}

// A function to convert emotion names into Hebrew
function getEmotionNameHebrew(emotion) {
  const emotionMap = {
    'angry': 'כעס',
    'disgust': 'גועל',
    'fear': 'פחד',
    'happy': 'שמחה',
    'sad': 'עצב',
    'surprise': 'הפתעה',
    'neutral': 'ניטרלי'
  };
  
  return emotionMap[emotion] || emotion;
}

export default App;