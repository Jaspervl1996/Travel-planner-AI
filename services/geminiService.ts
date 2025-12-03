import { GoogleGenAI, Type } from "@google/genai";
import { Stop, Activity, AppState } from '../types';

// Safely initialize the AI client
const apiKey = process.env.API_KEY || "";
let ai: GoogleGenAI | null = null;

try {
  // Only initialize if a key (even empty string) is present to avoid immediate crash,
  // though calls will fail later if key is invalid.
  ai = new GoogleGenAI({ apiKey });
} catch (e) {
  console.error("Failed to initialize GoogleGenAI client:", e);
}

const getAi = () => {
    if (!ai) {
        console.warn("GoogleGenAI client is not initialized (likely missing API Key).");
        // Attempt re-init or return a dummy that fails gracefully on calls if needed
        return new GoogleGenAI({ apiKey: "MISSING_KEY" });
    }
    return ai;
};

export const generatePackingSuggestions = async (
  location: string,
  month: string
): Promise<{ category: string; items: string[] }[]> => {
  try {
    const prompt = `Generate a packing list for a trip to ${location} in ${month}. Group items by category (Clothing, Toiletries, Electronics, Documents, Other).`;
    
    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Packing Error", error);
    return [];
  }
};

export const generateItinerarySuggestion = async (
  stops: Stop[],
  preferences: string
): Promise<string> => {
  try {
    const stopDesc = stops.map(s => `${s.place} (${s.start} to ${s.end})`).join(', ');
    const prompt = `Create a travel itinerary for: ${stopDesc}. Preferences: ${preferences}. Keep it concise and use emojis. Format as Markdown.`;

    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Could not generate itinerary.";
  } catch (error) {
    console.error("Gemini Itinerary Error", error);
    return "An error occurred while generating the itinerary.";
  }
};

export const suggestNextStop = async (stops: Stop[]): Promise<{ name: string; reason: string; lat: number; lng: number } | null> => {
  try {
    if (stops.length === 0) return null;
    const context = stops.map(s => s.place).join(' -> ');
    const prompt = `Given this travel route: ${context}. Suggest ONE logical next destination city or town that fits geographically. Return ONLY valid JSON with these fields: "name" (city name), "reason" (short marketing pitch), "lat" (number), "lng" (number).`;

    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            reason: { type: Type.STRING },
            lat: { type: Type.NUMBER },
            lng: { type: Type.NUMBER }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Suggestion Error", error);
    return null;
  }
};

export const askTripAssistant = async (
  message: string,
  tripState: AppState,
  chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[]
): Promise<string> => {
  try {
    // Simplify state for token efficiency, now including CRM status
    const context = {
        status: tripState.status, // CRM Status (Inquiry, Booked, etc.)
        client: tripState.clientName,
        trip: tripState.tripName,
        stops: tripState.stops.map(s => ({ place: s.place, start: s.start, end: s.end, hotel: s.accommodation })),
        budget: tripState.totalBudget,
        currency: tripState.homeCurrency,
        flights: tripState.flights.map(f => `${f.airline} ${f.from}->${f.to}`),
    };

    const systemInstruction = `You are a helpful travel agency assistant. You are assisting an agent with a specific trip. 
    Here is the JSON context of the current trip: ${JSON.stringify(context)}.
    
    The trip status is currently: "${tripState.status}".
    - If status is "inquiry", focus on exciting ideas and selling the destination.
    - If "proposal", focus on pricing clarity and finalizing details.
    - If "booked", focus on logistics, packing, and excitement.
    
    Answer questions about the itinerary, budget, or draft emails to the client. Keep answers professional but concise.
    If asked to draft an email, use placeholders like [Date] if needed.`;

    const chat = getAi().chats.create({
        model: 'gemini-2.5-flash',
        config: { systemInstruction },
        history: chatHistory
    });

    const result = await chat.sendMessage({ message });
    return result.text || "";
  } catch (error) {
      console.error("AI Assistant Error", error);
      return "I'm having trouble connecting right now. Please try again.";
  }
}

export const suggestAgencyTasks = async (
    status: string,
    tripDetails: string
): Promise<string[]> => {
    try {
        const prompt = `You are a senior travel agency manager. 
        A trip is currently in the "${status}" stage.
        Trip Details: ${tripDetails}.
        
        Generate a list of 3-5 critical administrative tasks for the agent to do next.
        Examples: "Send deposit invoice", "Collect passport copies", "Reconfirm special meal requests".
        Return ONLY a JSON array of strings.`;

        const response = await getAi().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });

        const text = response.text;
        if (!text) return [];
        return JSON.parse(text);
    } catch (error) {
        console.error("Gemini Task Error", error);
        return [];
    }
}

export const getPhrases = async (location: string): Promise<{ text: string; translation: string; pronunciation: string }[]> => {
  try {
    const prompt = `Give me 5 essential travel phrases for a tourist in ${location}.
    Return JSON array: [{ "text": "English phrase", "translation": "Local phrase", "pronunciation": "Phonetic" }].`;

    const response = await getAi().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        text: { type: Type.STRING },
                        translation: { type: Type.STRING },
                        pronunciation: { type: Type.STRING }
                    }
                }
            }
        }
    });
    return JSON.parse(response.text || '[]');
  } catch (e) {
      console.error(e);
      return [];
  }
}