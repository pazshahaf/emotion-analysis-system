# app.py - Emotion Analysis System for Job Interviews
# This Flask server analyzes emotions from face images and suggests appropriate interview questions

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import os
import cv2
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.layers import Conv2D
import base64
import io
from PIL import Image
import time
import requests
import random
from dotenv import load_dotenv
import traceback

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# LLaMA API Configuration
LLAMA_API_URL = os.getenv("LLAMA_API_URL")
LLAMA_API_KEY = os.getenv("LLAMA_API_KEY")
LLAMA_TEMPERATURE = float(os.getenv("LLAMA_TEMPERATURE", "0.7"))
LLAMA_MAX_TOKENS = int(os.getenv("LLAMA_MAX_TOKENS", "100"))

# Custom layer definition
class StandardizedConv2DWithOverride(Conv2D):
    def __init__(self, **kwargs):
        super(StandardizedConv2DWithOverride, self).__init__(**kwargs)

# Registering the custom layer
custom_objects = {'StandardizedConv2DWithOverride': StandardizedConv2DWithOverride}

# Model configuration
MODEL_PATH = "model_resnet50.h5"
model = None

# Alternative paths for model file
ALTERNATE_MODEL_PATHS = [
    "./model_resnet50.h5",
    "../model_resnet50.h5", 
    "backend/model_resnet50.h5",
    "./backend/model_resnet50.h5"
]

# Interview state management
used_questions = set()  # Track asked questions to avoid repetition
interview_started = False  # Track if interview has begun

# Fixed opening question for all interviews
OPENING_QUESTION = "אשמח שתציג/י את עצמך בקצרה ותספר/י על הניסיון המקצועי שלך."

def load_emotion_model():
    """
    Load the pre-trained emotion recognition model (ResNet50)
    Tries multiple paths to find the model file
    """
    global model
    
    try:
        print(f"Attempting to load model from: {MODEL_PATH}")
        with tf.keras.utils.custom_object_scope(custom_objects):
            model = load_model(MODEL_PATH)
        print(f"Model loaded successfully from: {MODEL_PATH}")
        return model
    except Exception as e:
        print(f"Error loading model from primary path: {str(e)}")
        
        # Try alternative paths
        for alt_path in ALTERNATE_MODEL_PATHS:
            try:
                print(f"Trying alternative path: {alt_path}")
                model = load_model(alt_path)
                print(f"Model loaded successfully from: {alt_path}")
                return model
            except Exception as alt_e:
                print(f"Error loading from {alt_path}: {str(alt_e)}")
        
        raise Exception("Cannot load model from any available paths")

# Question banks categorized by emotion type
emotion_category_questions = {
    'Positive Emotion': [
        "נראה שאתה/את מתחבר/ת לנושא, מה ספציפית מעניין אותך?",
        "מה מעניק לך סיפוק בעבודה?",
        "ספר/י לי על הישג מקצועי שאתה/את במיוחד גאה בו",
        "אילו חלקים בתפקיד הזה נשמעים לך הכי מהנים?",
        "מה בסביבת עבודה גורם לך להיות יצירתי/ת ומוטיבציוני/ת?",
        "מה הביא אותך להתעניין בתפקיד הזה?",
        "מה אתה/את מחפש/ת בצעד הקריירה הבא שלך?",
        "מה במשרה או בחברה הכי מעניין אותך?",
        "ספר/י לי על מצב בו הפתעת את עצמך ביכולות שלך",
        "מה לדעתך ייחודי בגישה שלך לפתרון בעיות מורכבות?"
    ],
    'Negative Emotion': [
        "אני מבחין/ה שיש משהו שמטריד אותך, האם תוכל/י לשתף מה זה?",
        "כיצד אתה/את מתמודד/ת עם מצבים מאתגרים בעבודה?",
        "האם תוכל/י לספר על מקרה בו התמודדת עם אתגר משמעותי?",
        "מה עוזר לך להירגע כשאתה/את חש/ה מתוח/ה?",
        "האם יש משהו שאני יכול/ה לעשות כרגע כדי לשפר את חווית הראיון?",
        "האם יש נושא שהיית מעדיף/ה שנדבר עליו?",
        "מה הם הערכים החשובים לך בסביבת עבודה?",
        "האם יש חששות ספציפיים לגבי התפקיד שתרצה/י לדבר עליהם?",
        "כיצד התמודדת בעבר עם אתגרים שהפחידו אותך בתחילה?",
        "מה עוזר לך להתמודד עם אי-ודאות או מצבים מורכבים?"
    ]
}

# Specific questions by individual emotion (backup/fallback)
emotion_specific_questions = {
    'angry': [
        "אני מבחין/ה שיש לך תחושת תסכול, האם תוכל/י לשתף מה מעורר אותה?",
        "כיצד אתה/את מתמודד/ת עם מצבים מאתגרים בעבודה?",
        "האם תוכל/י לספר על מקרה בו הצלחת להפוך כעס לאנרגיה חיובית?",
        "מה עוזר לך להירגע כשאתה/את חש/ה מתוח/ה?",
        "האם יש משהו שאני יכול/ה לעשות כרגע כדי לשפר את חווית הראיון?"
    ],
    'disgust': [
        "נראה שמשהו בשיחה שלנו מעורר אי נוחות, האם תרצה/י לשתף מה זה?",
        "האם יש נושא שהיית מעדיף/ה שנדבר עליו?",
        "מה הם הערכים החשובים לך בסביבת עבודה?",
        "כיצד את/ה מתמודד/ת עם משימות שאינן לטעמך?",
        "האם יש משהו שאוכל להבהיר לגבי התפקיד או החברה?"
    ],
    'fear': [
        "האם יש חששות ספציפיים לגבי התפקיד שתרצה/י לדבר עליהם?",
        "כיצד התמודדת בעבר עם אתגרים שהפחידו אותך בתחילה?",
        "מה עוזר לך להתמודד עם אי-ודאות?",
        "ספר/י לי על מקרה בו התגברת על פחד והשגת משהו משמעותי",
        "מהן נקודות החוזק שלך שעוזרות לך להתמודד עם סיטואציות מלחיצות?"
    ],
    'happy': [
        "נראה שאתה/את מתחבר/ת לנושא, מה ספציפית מעניין אותך?",
        "מה מעניק לך סיפוק בעבודה?",
        "ספר/י לי על הישג מקצועי שאתה/את במיוחד גאה בו",
        "אילו חלקים בתפקיד הזה נשמעים לך הכי מהנים?",
        "מה בסביבת עבודה גורם לך להיות יצירתי/ת ומוטיבציוני/ת?"
    ],
    'sad': [
        "אני מרגיש/ה שיש משהו שמטריד אותך, האם תרצה/י לשתף?",
        "מה עוזר לך להתמודד עם אתגרים בחיים המקצועיים?",
        "האם יש משהו שתרצה/י לשאול לגבי התרבות הארגונית שלנו?",
        "איך הניסיון שלך בעבר עיצב את הגישה שלך לאתגרים?",
        "מהם המשאבים שעוזרים לך להתמודד עם תקופות לחוצות?"
    ],
    'surprise': [
        "נראה שמשהו הפתיע אותך, האם תרצה/י לשתף מה זה?",
        "מה במשרה או בחברה הכי הפתיע אותך לטובה?",
        "ספר/י לי על מצב בו הפתעת את עצמך ביכולות שלך",
        "איך אתה/את מתמודד/ת עם שינויים לא צפויים?",
        "מה לדעתך ייחודי בגישה שלך לפתרון בעיות מורכבות?"
    ],
    'neutral': [
        "מה הביא אותך להתעניין בתפקיד הזה?",
        "מה אתה/את מחפש/ת בצעד הקריירה הבא שלך?",
        "איך היית מתאר/ת את סגנון העבודה שלך?",
        "אילו שאלות יש לך על התפקיד או החברה?",
        "מהן הציפיות שלך מהמנהל/ת הישיר/ה שלך?"
    ]
}

# Prompt templates for LLaMA API  
emotion_prompt_templates = {
    'Positive Emotion': """
    אתה מראיין מועמד לעבודה וזיהית רגש חיובי ({emotion}) בתגובה של המועמד. 
    רמת הביטחון בזיהוי היא {confidence}%. 
    
    אני צריך שאלת המשך אחת שתהיה:
    1. מותאמת לסיטואציית ראיון עבודה
    2. קשורה לרגש החיובי שזיהית
    3. מעודדת את המועמד לשתף מידע מקצועי רלוונטי
    4. קצרה ותמציתית (לא יותר מ-2 משפטים)
    5. בעברית בלבד, בניסוח מנומס ומקצועי
    
    הצג את השאלה בלבד, ללא הקדמות או הסברים.
    """,
    
    'Negative Emotion': """
    אתה מראיין מועמד לעבודה וזיהית רגש שלילי ({emotion}) בתגובה של המועמד.
    רמת הביטחון בזיהוי היא {confidence}%.
    
    אני צריך שאלת המשך אחת שתהיה:
    1. מותאמת לסיטואציית ראיון עבודה
    2. מתייחסת ברגישות לרגש השלילי שזיהית מבלי להזכיר אותו ישירות
    3. עוזרת למועמד להרגיש בנוח ולהמשיך את הראיון בצורה חיובית
    4. קצרה ותמציתית (לא יותר מ-2 משפטים)
    5. בעברית בלבד, בניסוח מנומס ומקצועי
    
    הצג את השאלה בלבד, ללא הקדמות או הסברים.
    """
}

# Emotion detection thresholds
emotion_thresholds = {
    'angry': 0.7,
    'disgust': 0.9, 
    'fear': 0.7,
    'happy': 0.4,
    'sad': 0.5,
    'surprise': 0.5,
    'neutral': 0.2
}

# Emotion categorization
positive_emotions = {'happy', 'surprise', 'neutral'}
negative_emotions = {'angry', 'disgust', 'fear', 'sad'}

def preprocess_image(image_data):
    """
    Preprocess image for emotion recognition model
    Resizes to 48x48, handles color channels, normalizes pixel values
    """
    try:
        print(f"Original image size: {image_data.shape}")
        img = cv2.resize(image_data, (48, 48))
        print(f"Resized image to: {img.shape}")
        
        # Handle color conversion if needed
        if len(img.shape) == 3 and img.shape[2] == 3:
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            print("Converted from BGR to RGB")
        
        # Handle channel requirements based on model input shape
        input_shape = model.input_shape
        print(f"Model expects shape: {input_shape}")
        
        if len(input_shape) > 1:
            expected_channels = input_shape[-1]
            if expected_channels == 1 and len(img.shape) == 3 and img.shape[2] == 3:
                img = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
                img = np.expand_dims(img, axis=-1)
                print("Converted to grayscale with single channel")
            elif expected_channels == 3 and (len(img.shape) == 2 or img.shape[2] == 1):
                img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
                print("Converted from grayscale to RGB")
        
        # Normalize pixel values and add batch dimension
        img = img.astype('float32') / 255.0
        img = np.expand_dims(img, axis=0)
        print(f"Final image shape for model: {img.shape}")
        return img
    except Exception as e:
        print(f"Error in image preprocessing: {str(e)}")
        raise

def is_question_used(question):
    """Check if a question has already been asked in current interview"""
    return question in used_questions

def get_llama_question(emotion, emotion_category, confidence, max_attempts=3):
    """
    Get adaptive question from LLaMA API based on detected emotion
    Ensures no question repetition within same interview
    """
    global interview_started
    
    # Return opening question for new interviews
    if not interview_started:
        interview_started = True
        used_questions.add(OPENING_QUESTION)
        return OPENING_QUESTION
    
    try:
        for attempt in range(max_attempts):
            # Select appropriate prompt template
            prompt_template = emotion_prompt_templates.get(
                emotion_category, 
                emotion_prompt_templates['Positive Emotion']
            )
            
            # Format prompt with emotion and confidence
            emotion_hebrew = {
                'happy': 'שמחה',
                'surprise': 'הפתעה', 
                'neutral': 'ניטרליות',
                'angry': 'כעס',
                'disgust': 'גועל',
                'fear': 'פחד',
                'sad': 'עצב'
            }.get(emotion, emotion)
            
            prompt = prompt_template.format(
                emotion=emotion_hebrew,
                confidence=confidence * 100
            )
            
            # Configure API request
            headers = {"Authorization": f"Bearer {LLAMA_API_KEY}"}
            payload = {
                "inputs": prompt,
                "parameters": {
                    "max_new_tokens": LLAMA_MAX_TOKENS,
                    "temperature": LLAMA_TEMPERATURE,
                    "return_full_text": False
                }
            }
            
            # Send request to LLaMA API
            response = requests.post(LLAMA_API_URL, headers=headers, json=payload, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                
                # Extract generated text from response
                if isinstance(result, list) and len(result) > 0:
                    generated_text = result[0].get('generated_text', '')
                elif isinstance(result, dict):
                    generated_text = result.get('generated_text', '')
                else:
                    generated_text = str(result)
                
                generated_text = generated_text.strip()
                
                # Check if question is unique and not empty
                if generated_text and not is_question_used(generated_text):
                    used_questions.add(generated_text)
                    return generated_text
                
                print(f"Attempt {attempt+1}: Question already used or empty. Retrying.")
            else:
                print(f"LLaMA API error. Status: {response.status_code}, Content: {response.text}")
        
        # Fallback to predefined questions if LLaMA fails
        return get_fallback_question(emotion_category)
        
    except Exception as e:
        print(f"Error calling LLaMA API: {str(e)}. Using fallback questions.")
        return get_fallback_question(emotion_category)

def get_fallback_question(emotion_category):
    """
    Get random question from predefined question bank
    Filters out already used questions
    """
    questions = emotion_category_questions.get(
        emotion_category, 
        emotion_category_questions['Positive Emotion']
    )
    
    # Filter out used questions
    unused_questions = [q for q in questions if not is_question_used(q)]
    
    # Reset used questions if all have been asked (except opening question)
    if not unused_questions:
        opening = OPENING_QUESTION
        used_questions.clear()
        if opening in used_questions:
            used_questions.add(opening)
        unused_questions = questions
    
    # Select random unused question
    selected_question = random.choice(unused_questions)
    used_questions.add(selected_question)
    return selected_question

def analyze_emotion(image_data):
    """
    Main emotion analysis function
    Processes image, predicts emotions, and generates appropriate question
    """
    global model
    if model is None:
        model = load_emotion_model()
    
    # Preprocess image for model
    processed_img = preprocess_image(image_data)
    
    # Predict emotions
    print("Performing emotion prediction...")
    probs = model.predict(processed_img)[0]
    emotion_labels = list(emotion_thresholds.keys())
    detected_emotions = {emotion_labels[i]: float(probs[i]) for i in range(len(probs))}
    print(f"Detected emotions: {detected_emotions}")
    
    # Find highest confidence emotions by category
    max_positive_prob = 0
    max_negative_prob = 0
    
    for emotion, prob in detected_emotions.items():
        if emotion in positive_emotions and prob >= emotion_thresholds[emotion]:
            if prob > max_positive_prob:
                max_positive_prob = prob
        elif emotion in negative_emotions and prob >= emotion_thresholds[emotion]:
            if prob > max_negative_prob:
                max_negative_prob = prob
    
    print(f"Max positive emotion confidence: {max_positive_prob}")
    print(f"Max negative emotion confidence: {max_negative_prob}")
    
    # Determine final emotion category and specific emotion
    if max_positive_prob > max_negative_prob and max_positive_prob > 0:
        category = "Positive Emotion"
        confidence = max_positive_prob
        classified_emotion = max(
            ((e, p) for e, p in detected_emotions.items() if e in positive_emotions),
            key=lambda x: x[1]
        )[0]
    elif max_negative_prob > 0:
        category = "Negative Emotion"
        confidence = max_negative_prob
        classified_emotion = max(
            ((e, p) for e, p in detected_emotions.items() if e in negative_emotions),
            key=lambda x: x[1]
        )[0]
    else:
        category = "Positive Emotion"
        classified_emotion = "neutral"
        confidence = detected_emotions['neutral']
    
    print(f"Final classified emotion: {classified_emotion}, Category: {category}, Confidence: {confidence}")
    
    # Generate appropriate question using LLaMA or fallback
    try:
        suggested_question = get_llama_question(classified_emotion, category, confidence)
        print(f"Generated question: {suggested_question}")
    except Exception as e:
        print(f"Error getting LLaMA question: {str(e)}. Using fallback.")
        suggested_question = get_fallback_question(category)
        print(f"Fallback question from category {category}: {suggested_question}")
    
    return {
        'classified_emotion': classified_emotion,
        'category': category,
        'confidence': float(confidence),
        'detected_emotions': detected_emotions,
        'suggested_question': suggested_question
    }

# API Endpoints

@app.route('/api/reset-interview', methods=['POST'])
def reset_interview():
    """Reset interview state for new interview session"""
    global used_questions, interview_started
    used_questions.clear()
    interview_started = False
    return jsonify({
        'status': 'success',
        'message': 'Interview state reset successfully. Next interview will start with opening question.'
    })

@app.route('/api/analyze', methods=['POST', 'OPTIONS'])
def analyze_screenshot():
    """
    Main endpoint for emotion analysis
    Accepts image data and returns emotion analysis with suggested question
    """
    # Handle CORS preflight requests
    if request.method == 'OPTIONS':
        response = Response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Accept')
        response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
        return response
        
    try:
        print(f"Received {request.method} request for image analysis")
        
        # Validate image data in request
        if 'image' not in request.files and 'image' not in request.form:
            print("Error: No image data received")
            return jsonify({'error': 'No image data received in request'}), 400
        
        # Process image from file upload
        if 'image' in request.files:
            print("Image received as file upload")
            image_file = request.files['image']
            img_bytes = image_file.read()
            img = Image.open(io.BytesIO(img_bytes))
            img = np.array(img)
        else:
            # Process base64 encoded image
            print("Image received as base64")
            image_data = request.form['image']
            if ',' in image_data:
                header, image_b64 = image_data.split(',', 1)
            else:
                image_b64 = image_data
            
            try:
                img_bytes = base64.b64decode(image_b64)
                img = Image.open(io.BytesIO(img_bytes))
                img = np.array(img)
            except Exception as decode_error:
                print(f"Error decoding image: {str(decode_error)}")
                raise
        
        print(f"Image processed successfully. Shape: {img.shape}")
        
        # Perform emotion analysis
        result = analyze_emotion(img)
        print(f"Analysis results: {result['classified_emotion']} with confidence {result['confidence']}")
        
        response = jsonify(result)
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response
    
    except Exception as e:
        print("Error in image analysis:")
        traceback.print_exc()
        error_response = jsonify({'error': str(e)})
        error_response.headers.add('Access-Control-Allow-Origin', '*')
        return error_response, 500

@app.route('/api/test', methods=['GET'])
def test_api():
    """Simple endpoint to check server availability"""
    return jsonify({
        'status': 'success',
        'message': 'Server is active and responding',
        'time': time.strftime('%Y-%m-%d %H:%M:%S')
    })

@app.route('/api/used-questions', methods=['GET'])
def get_used_questions():
    """Get list of questions already asked in current interview"""
    return jsonify({
        'status': 'success',
        'count': len(used_questions),
        'questions': list(used_questions)
    })

if __name__ == '__main__':
    try:
        # Attempt to load model before starting server
        print("Attempting to load emotion recognition model...")
        try:
            load_emotion_model()
            print("Model loaded successfully, starting server...")
        except Exception as model_error:
            print(f"Warning: Could not load model: {str(model_error)}")
            print("Continuing server startup anyway...")
        
        # Start Flask server
        app.run(debug=True, host='0.0.0.0', port=5001)
    except Exception as e:
        print(f"Critical error: {str(e)}")
        traceback.print_exc()