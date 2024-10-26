import nest_asyncio
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from langchain.chains import LLMChain
from langchain.llms import CTransformers
from langchain.prompts import PromptTemplate
from pyngrok import ngrok
import torch
import asyncio

# Apply the nest_asyncio patch
nest_asyncio.apply()

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Ensure the usage of GPU if available
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Using device: {device}")

# Model configurations
MODEL_KWARGS = {
    "mistral": {
        "model": "TheBloke/Mistral-7B-Instruct-v0.1-GGUF",
        "model_file": "mistral-7b-instruct-v0.1.Q4_K_M.gguf",
        "device": device
    },
}

# Template for the prompt
llm_chains = {}

# Updated Template for the prompt
TEMPLATE = """<s>[INST] You are an advanced AI assistant specializing in health and wellness. Start the conversation by introducing yourself and asking the user about their health goals or concerns. Provide insights on chronic disease risks and offer mental health support. Respond naturally and empathetically based on the previous messages:\n{context}\nUser: {user_input} [/INST] </s>
"""

def get_predictions(user_input: str, context: str = ""):
    config = {"temperature": 0.5}
    results = {}

    for model in MODEL_KWARGS:
        if model not in llm_chains:
            print(f"Loading model: {model}")
            llm = CTransformers(**MODEL_KWARGS[model], config=config)
            prompt = PromptTemplate(template=TEMPLATE, input_variables=["user_input", "context"])
            llm_chain = LLMChain(prompt=prompt, llm=llm)
            llm_chains[model] = llm_chain

        # Send user input along with the context
        full_input = user_input
        print(f"User message: {full_input}")
        response = asyncio.run(llm_chains[model].apredict(user_input=full_input, context=context))
        print(f"Model response for {model}: {response}")
        results[model] = response

    return results

def generate_chat_stream(user_message, context):
    updated_context = f"{context}\nUser: {user_message}" if context else f"User: {user_message}"
    results = get_predictions(user_message, updated_context)

    # Stream responses back
    model_response = results[list(results.keys())[0]]
    updated_context += f"\nBot: {model_response}"  # Update context with the bot's response

    yield f"data: {model_response}\n\n"  # Send the response as a stream
    yield f"data: {updated_context}\n\n"  # Optionally stream updated context

@app.route('/chat', methods=['POST'])
def chat():
    user_message = request.json.get('message')
    context = request.json.get('context', '')  # Get context from the request

    if not user_message:
        return jsonify({"error": "Message is required"}), 400

    return Response(stream_with_context(generate_chat_stream(user_message, context)),
                    mimetype='text/event-stream')

if __name__ == '__main__':
    ngrok_tunnel = ngrok.connect(5000)
    print('Public URL:', ngrok_tunnel.public_url)
    app.run(port=5000)