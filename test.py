import os

from groq import Groq

client = Groq(
    api_key=os.getenv("GROQ_API_KEY"),
)

stream = client.chat.completions.create(
    messages=[
        {
            "role": "user",
            "content": "Explain the importance of fast language models",
        }
    ],
    model="moonshotai/kimi-k2-instruct-0905",
    stream=True
)

for c in stream:
    print(c)

    ''' docker exec -it qiyasai-postgres psql -U qiyas -d qiyasai -c "DROP TABLE IF EXISTS
>>    messages, conversations CASCADE;"  '''