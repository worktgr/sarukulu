import 'react-native-gesture-handler'; // must be first
import 'react-native-reanimated';      // keep this at the very top too
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
