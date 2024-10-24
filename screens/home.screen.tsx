import { StyleSheet, Text, View, StatusBar, Image, TouchableOpacity, Alert } from 'react-native'
import React, { useState } from 'react'
import { LinearGradient } from 'expo-linear-gradient'
import { scale, verticalScale } from 'react-native-size-matters'
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Audio } from 'expo-av';
import axios from 'axios';
import LottieView from 'lottie-react-native';
import * as Speech from "expo-speech";


export default function HomeScreen() {
    const [text, setText] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [loading, setLoading] = useState(false);
    const [recording, setRecording] = useState<Audio.Recording>();
    const [AIResponse, setAIResponse] = useState(false);

    const getMicrophonePermission = async () => {
        try {
            const { granted } = await Audio.requestPermissionsAsync();

            if (!granted) {
                Alert.alert("Permission", "Please grant permission to access microphone");
                return false;
            }
        } catch (error) {
            console.log(error);
            return false;
        }
    }

    const recordingOptions: any = {
        android: {
            extension: ".wav",
            outPutFormat: Audio.AndroidOutputFormat.MPEG_4,
            androidEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
        },
        ios: {
            extension: ".wav",
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
        },
    }

    const startRecording = async () => {
        const hasPermission = await getMicrophonePermission();
        if (!hasPermission) return;
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,//true is 耳机 false --- 扬声器
                playsInSilentModeIOS: true,
            });
            setIsRecording(true);
            const { recording } = await Audio.Recording.createAsync(recordingOptions);
            setRecording(recording);
        } catch (error) {
            console.log("Failed to start Recording", error);
            Alert.alert("Error", "Failed to start recording");
        }
    }

    const stopRecording = async () => {
        try {
            setIsRecording(false);
            setLoading(true);
            await recording?.stopAndUnloadAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
            });

            const uri = recording?.getURI();

            //send sudio to whisper API to transcription
            const transcript = await sendAudioToWhisper(uri!);

            setText(transcript);

            //send the transcript to gpt-4 API for response
            const gptResponse = await sendToGpt(transcript);
            setAIResponse(true);

        } catch (error) {
            console.log("Fail to stop Recording", error);
            Alert.alert("Error", "Failed to stop recording");
        }
    };

    const sendAudioToWhisper = async (uri: string) => {
        try {
            const formData: any = new FormData();
            formData.append("file", {
                uri,
                type: "audio/wav",
                name: "recording.wav",
            });
            formData.append("model", "paraformer-8k-v1");
            const response = await axios.post(
                "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription",
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
                        "Content-Type": "mltipart/form-data",
                        "X-DashScope-Async": "enable",
                    },
                }
            );
            console.log(response.data.text);
            return response.data.text;

        } catch (error) {
            console.log(error);
        }
    }

    //send text to gpt API
    const sendToGpt = async (text: string) => {
        try {
            const response = await axios.post(
                "https://api.openai.com/v1/chat/completions",
                {
                    model: "gpt-4",
                    messages: [
                        {
                            role: "system",
                            content:
                                "You are Artifonia, a friendly AI assistant who responds naturally and referes to yourself as Artifonia when asked for your name. You are a helpful assistant who can answer questions and help with tasks. You must always respond in English, no matter the input language,and provide helpful, clear answers",
                        },
                        {
                            role: "user",
                            content: text,
                        },
                    ],
                },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
                        "Content-Type": "application/json",
                    },
                }
            );
            setText(response.data.choices[0].message.content);
            setLoading(false);
            setAIResponse(true);
            await speakText(response.data.choices[0].message.content);
            return response.data.choices[0].message.content;
        } catch (error) {
            console.log("Error sending text to GPT-4", error);
        }
    }

    const speakText = async (text: string) => {
        const options = {
            voice: "com.apple.ttsbundle.Samantha-compact",
            language: "en-US",
            pitch: 1.5,
            rate: 1,
            // onDone: () => {
            //     setAISpeaking(false);
            // }
        };
        Speech.speak(text, options);
    }

    return (
        <LinearGradient
            colors={['#250152', '#000000']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.container}
        >
            <StatusBar barStyle="light-content" />

            {/* back shdows */}
            <Image
                source={require("@/assets/main/blur.png")}
                style={styles.blur}
            />
            <Image
                source={require("@/assets/main/purple-blur.png")}
                style={styles.purple_blur}
            />

            <View style={{ marginTop: verticalScale(-40) }}>
                {
                    loading ? (
                        <TouchableOpacity
                            onPress={() => speakText(text)}
                        >
                            <LottieView
                                source={require("@/assets/animations/loading.json")}
                                autoPlay
                                loop
                                speed={1.3}
                                style={{ width: scale(270), height: scale(270) }}
                            />
                        </TouchableOpacity>
                    ) : (
                        <>
                            {
                                !isRecording ? (
                                    <>
                                        <TouchableOpacity
                                            style={styles.touchable}
                                            onPress={startRecording}
                                        >
                                            <FontAwesome name="microphone" size={scale(50)} color="#2b3356" />
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <TouchableOpacity onPress={stopRecording}>
                                        <LottieView
                                            source={require("@/assets/animations/animation.json")}
                                            autoPlay
                                            loop
                                            speed={1.3}
                                            style={{ width: scale(250), height: scale(250) }}
                                        />
                                    </TouchableOpacity>
                                )
                            }
                        </>
                    )
                }
            </View>

            <View style={{
                width: scale(350),
                alignItems: "center",
                position: "absolute",
                bottom: verticalScale(90),
            }}>
                <Text style={{
                    color: "#ffffff",
                    fontSize: scale(17),
                    width: scale(270),
                    textAlign: "center",
                    lineHeight: 25,
                }}>
                    {loading ? "..." : text || "Press the microphone to start recording!"}
                </Text>
            </View>

        </LinearGradient>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#131313"
    },
    blur: {
        position: "absolute",
        right: scale(-15),
        top: 0,
        width: scale(240),
    },
    purple_blur: {
        position: "absolute",
        right: scale(150),
        bottom: verticalScale(60),
        width: scale(210),
    },
    touchable: {
        width: scale(110),
        height: scale(110),
        backgroundColor: "#ffffff",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: scale(100),
    }

})