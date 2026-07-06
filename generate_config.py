import os
import json
import wave
import contextlib

def get_wav_duration_str(file_path):
    """Calculates wave audio duration and formats it as MM:SS."""
    try:
        with contextlib.closing(wave.open(file_path, 'rb')) as f:
            frames = f.getnframes()
            rate = f.getframerate()
            if rate > 0:
                duration_seconds = frames / float(rate)
                mins = int(duration_seconds) // 60
                secs = int(duration_seconds) % 60
                return f"{mins:02d}:{secs:02d}"
    except Exception as e:
        print(f"Erro ao ler duração do arquivo {file_path}: {e}")
    return "00:00"

def clean_name(name):
    """Converts filenames like '01_exercicio_fala.wav' into clean titles like '01 Exercicio Fala'."""
    base = os.path.splitext(name)[0]
    clean = base.replace("_", " ").replace("-", " ")
    return clean.title()

def main():
    print("====================================================")
    print("      GERADOR DE CATÁLOGO AUTOMÁTICO - FONOPLAYER   ")
    print("====================================================")
    print("Este script vai escanear suas pastas de áudio locais,")
    print("calcular a duração de cada WAV e criar o JSON do catálogo.")
    print("----------------------------------------------------\n")

    # Ask for GitHub configuration (with defaults to user repository)
    github_user = input("Nome do seu usuário do GitHub [padrão: gustavo0070000]: ").strip()
    if not github_user:
        github_user = "gustavo0070000"
        
    github_repo = input("Nome do repositório no GitHub [padrão: fonoApp]: ").strip()
    if not github_repo:
        github_repo = "fonoApp"
        
    github_branch = input("Branch padrão [padrão: main]: ").strip()
    if not github_branch:
        github_branch = "main"

    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Check if a dedicated 'Cds' directory exists
    cds_folder_path = os.path.join(current_dir, "Cds")
    if os.path.isdir(cds_folder_path):
        scan_dir = cds_folder_path
        url_prefix = "Cds/"
        print("-> Pasta 'Cds' detectada! Escaneando subpastas de CDs dentro dela...")
    else:
        scan_dir = current_dir
        url_prefix = ""
        print("-> Pasta 'Cds' não encontrada. Escaneando diretório raiz...")

    # Exclude system and build directories if scanning root
    ignored_dirs = {'.git', '__pycache__', 'cache', 'build', 'dist', '.idea', 'venv', 'env', 'Cds'}
    
    cds_list = []
    
    # Scan all directories in the target scan directory
    for item in sorted(os.listdir(scan_dir)):
        item_path = os.path.join(scan_dir, item)
        # If we are scanning root, ignore system folders
        if os.path.isdir(item_path):
            if scan_dir == current_dir and item in ignored_dirs:
                continue
                
            cd_id = item
            cd_title = clean_name(item)
            
            print(f"\nCD Encontrado: {cd_title} (pasta: '{item}')")
            
            # Scan for cover image
            cover_filename = ""
            cover_names = {'cover.jpg', 'cover.png', 'cover.jpeg', 'capa.jpg', 'capa.png', 'capa.jpeg'}
            for file in os.listdir(item_path):
                if file.lower() in cover_names:
                    cover_filename = file
                    break
            
            cover_url = ""
            if cover_filename:
                cover_url = f"https://raw.githubusercontent.com/{github_user}/{github_repo}/{github_branch}/{url_prefix}{item}/{cover_filename}"
                print(f"  -> Capa de CD detectada: {cover_filename}")
            
            tracks = []
            track_num = 1
            
            # Scan files inside folder
            for file in sorted(os.listdir(item_path)):
                if file.lower().endswith('.wav'):
                    file_path = os.path.join(item_path, file)
                    duration_str = get_wav_duration_str(file_path)
                    track_title = clean_name(file)
                    
                    # Construct GitHub Raw URL
                    raw_url = f"https://raw.githubusercontent.com/{github_user}/{github_repo}/{github_branch}/{url_prefix}{item}/{file}"
                    
                    tracks.append({
                        "track_number": track_num,
                        "title": track_title,
                        "url": raw_url,
                        "duration": duration_str
                    })
                    print(f"  -> Faixa {track_num:02d}: {track_title} ({duration_str})")
                    track_num += 1
            
            if tracks:
                cds_list.append({
                    "id": cd_id,
                    "title": cd_title,
                    "description": f"Exercícios e faixas de áudio do CD {cd_title}.",
                    "cover_url": cover_url,
                    "tracks": tracks
                })
            else:
                print("  (Nenhum arquivo WAV encontrado dentro desta pasta)")

    if not cds_list:
        print("\n[AVISO] Nenhuma pasta de CD com arquivos WAV foi encontrada!")
        print("Para gerar o catálogo, crie uma pasta no mesmo diretório (ex: 'Livro_1_CD_1')")
        print("e coloque seus arquivos .wav dentro dela, depois rode este script novamente.")
        input("\nPressione Enter para sair...")
        return

    output_data = {
        "app_version": "1.0",
        "app_url": f"https://github.com/{github_user}/{github_repo}/raw/{github_branch}/FonoPlayer.exe",
        "cds": cds_list
    }
    output_file = os.path.join(current_dir, "meus_cds.json")
    
    # Save the configuration JSON
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=4, ensure_ascii=False)
        
    print(f"\n====================================================")
    print(f"SUCESSO! Arquivo gerado em: {output_file}")
    print(f"DICA: Envie este arquivo 'meus_cds.json' e as pastas de áudio")
    print(f"para o seu GitHub para que o aplicativo possa ler os dados.")
    print(f"====================================================")
    input("\nPressione Enter para fechar...")

if __name__ == "__main__":
    main()
