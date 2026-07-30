"""Test edge-tts Vietnamese voice availability and synthesis."""
import asyncio
import edge_tts

async def main():
    voices = await edge_tts.list_voices()
    vi_voices = [v for v in voices if v["Locale"].startswith("vi-")]
    print("Vietnamese voices:")
    for v in vi_voices:
        print(f"  {v['ShortName']} -- {v['Gender']} -- {v.get('FriendlyName', '')}")
    
    # Test synthesis
    test_text = "Xin chào anh Liêm. Đây là Mi-Core, trợ lý quản lý của anh."
    voice = "vi-VN-HoaiMyNeural"
    output = "E:/Project/Master/mi-core/scripts/test-tts-output.mp3"
    print(f"\nSynthesizing with {voice}...")
    communicate = edge_tts.Communicate(test_text, voice)
    await communicate.save(output)
    print(f"Saved to {output}")
    
    # Test code-switching
    mixed_text = "Anh Liêm, hôm nay có 3 tasks từ Asana cần review. DoorDash revenue là $12,500. QuickBooks sync OK."
    output2 = "E:/Project/Master/mi-core/scripts/test-tts-codeswitch.mp3"
    print(f"\nTesting code-switching with mixed Vi-En text...")
    communicate2 = edge_tts.Communicate(mixed_text, voice)
    await communicate2.save(output2)
    print(f"Saved to {output2}")
    print("\nAll tests passed!")

asyncio.run(main())
