import anthropic
import os

# --- Configuration ---
# Set your API key as an environment variable for security
# In your terminal (Mac/Linux): export ANTHROPIC_API_KEY="your_api_key_here"
# In your terminal (Windows): set ANTHROPIC_API_KEY="your_api_key_here"
#
# Or, for a quick test (less secure), uncomment the line below:
# os.environ["ANTHROPIC_API_KEY"] = "sk-ant-..." 

try:
    client = anthropic.Anthropic() # Client automatically finds the API key in env variables
except anthropic.AuthenticationError as e:
    print("Authentication Error: Please set your ANTHROPIC_API_KEY environment variable.")
    print(f"Details: {e}")
    exit()

print("--- Your Personal Claude API Access ---")
print("Type 'exit' or 'quit' to end the chat.")
print("-" * 40)

# Keep the conversation history
conversation_history = []

while True:
    try:
        # 1. Get user input
        user_prompt = input("You: ")
        
        if user_prompt.lower() in ['exit', 'quit']:
            print("\nGoodbye!")
            break

        # 2. Add user message to history
        conversation_history.append({"role": "user", "content": user_prompt})

        # 3. Send to the API
        with client.messages.stream(
            model="claude-3-sonnet-20240229", # You can change the model here
            max_tokens=1024,
            messages=conversation_history
        ) as stream:
            
            print("\nClaude: ", end="", flush=True)
            
            # 4. Stream the response
            response_text = ""
            for text in stream.text_stream:
                print(text, end="", flush=True)
                response_text += text
            
            print("\n") # Add a newline after Claude finishes
            
            # 5. Add Claude's response to history
            conversation_history.append({"role": "assistant", "content": response_text})

    except anthropic.RateLimitError:
        print("\n--- Error: You've hit the API rate limit. Please wait a moment. ---")
    except Exception as e:
        print(f"\nAn error occurred: {e}")
        break
