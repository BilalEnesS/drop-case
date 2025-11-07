from app.core.config import settings
import httpx
import re


def clean_description(text: str) -> str:
    # Remove hashtags and clean up the text
    text = re.sub(r'#\w+\s*', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    # Limit to 200 characters
    if len(text) > 200:
        text = text[:197] + "..."
    return text


async def suggest_drop_description(title: str) -> str:
    # AI-powered description suggestion for drops
    # Uses OpenAI API if available, otherwise returns a simple suggestion
    
    if not settings.OPENAI_API_KEY:
        # Fallback: Simple description based on title
        return f"Exclusive limited edition {title}. Don't miss out on this special offer!"
    
    try:
        # Use OpenAI API to generate description
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-3.5-turbo",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a marketing assistant. Generate a concise, engaging product description for a limited edition drop. Keep it under 150 characters. Do not include hashtags or emojis. Write in a professional, appealing tone."
                        },
                        {
                            "role": "user",
                            "content": f"Generate a short product description for this drop: {title}"
                        }
                    ],
                    "max_tokens": 80,
                    "temperature": 0.7
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                description = data["choices"][0]["message"]["content"].strip()
                # Clean hashtags and limit length
                description = clean_description(description)
                return description
            else:
                # Fallback on API error
                return f"Exclusive limited edition {title}. Don't miss out on this special offer!"
    
    except Exception as e:
        # Fallback on any error
        print(f"AI service error: {e}")  # Debug logging
        return f"Exclusive limited edition {title}. Don't miss out on this special offer!"

