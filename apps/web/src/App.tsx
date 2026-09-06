import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { MusicsPage } from "./pages/MusicsPage";
import { MusicUploadPage } from "./pages/MusicUploadPage";
import { PlaylistDetailPage } from "./pages/PlaylistDetailPage";
import { PlaylistNewPage } from "./pages/PlaylistNewPage";
import { PlaylistsPage } from "./pages/PlaylistsPage";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="musics" element={<MusicsPage />} />
        <Route path="musics/new" element={<MusicUploadPage />} />
        <Route path="playlists" element={<PlaylistsPage />} />
        <Route path="playlists/new" element={<PlaylistNewPage />} />
        <Route path="playlists/:id" element={<PlaylistDetailPage />} />
      </Route>
    </Routes>
  );
}
